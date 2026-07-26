import type { ReleasedPageTurnGesture } from "@persimmon/page-turn-core";

import { PAGE_TURN_LANE_HARD_LIMIT } from "./page-turn-concurrency";
import { samePageAddress, type PageAddress } from "./section-navigation";

export const PAGE_TURN_START_INTERVAL_MS = 150;

export interface ScheduledPageTurn {
  readonly id: string;
  readonly from: PageAddress;
  readonly to: PageAddress;
  readonly direction: 1 | -1;
  readonly lane: number;
  /**
   * True only while a finger owns the shared interactive driver.
   * Released gestures become autonomous lane animations immediately.
   */
  readonly interactive: boolean;
  /**
   * Native keeps rendering the interactive frame until the destination lane
   * confirms that it has installed the released-gesture state.
   */
  readonly handoffPending: boolean;
  readonly motion: "tap" | "gesture";
  readonly gestureRelease?: ReleasedPageTurnGesture;
  readonly completed: boolean;
}

export interface PageTurnSchedulerState {
  readonly settled: PageAddress;
  readonly desired: PageAddress;
  readonly turns: readonly ScheduledPageTurn[];
  readonly nextTapStartAtMs: number;
}

export interface PageTurnScheduler {
  readonly adjacent: (address: PageAddress, direction: 1 | -1) => PageAddress;
  readonly createId: () => string;
  readonly maximumConcurrentTurns?: number;
  readonly maximumConcurrentTapTurns?: number;
  readonly minimumTurnIntervalMs?: number;
}

export function createPageTurnSchedulerState(
  initial: PageAddress,
): PageTurnSchedulerState {
  return {
    settled: initial,
    desired: initial,
    turns: [],
    nextTapStartAtMs: 0,
  };
}

/**
 * Starts at most one turn for this input. There is deliberately no pending
 * queue: tap input inside the configured throttle window, input at full lane
 * capacity, or input against the current stack direction is dropped instead
 * of replayed later. Gestures have their own input cadence and bypass only the
 * tap throttle.
 */
export function requestScheduledPageTurn(
  state: PageTurnSchedulerState,
  direction: 1 | -1,
  scheduler: PageTurnScheduler,
  requestedAtMs = Date.now(),
): PageTurnSchedulerState {
  return tryStartScheduledTurn(
    state,
    direction,
    scheduler,
    requestedAtMs,
    false,
    "tap",
  );
}

export function requestScheduledGesturePageTurn(
  state: PageTurnSchedulerState,
  direction: 1 | -1,
  release: ReleasedPageTurnGesture,
  scheduler: PageTurnScheduler,
  requestedAtMs = Date.now(),
): PageTurnSchedulerState {
  return tryStartScheduledTurn(
    state,
    direction,
    scheduler,
    requestedAtMs,
    false,
    "gesture",
    release,
    false,
  );
}

/**
 * A released gesture no longer monopolizes the interactive driver until its
 * paper lands. Once its lane has accepted the release state, another finger
 * may append the next physical sheet while earlier sheets are still moving.
 */
export function beginScheduledInteractivePageTurn(
  state: PageTurnSchedulerState,
  direction: 1 | -1,
  scheduler: PageTurnScheduler,
  requestedAtMs = Date.now(),
): PageTurnSchedulerState {
  if (state.turns.some((turn) => turn.interactive || turn.handoffPending)) {
    return state;
  }
  return tryStartScheduledTurn(
    state,
    direction,
    scheduler,
    requestedAtMs,
    true,
    "gesture",
    undefined,
    false,
  );
}

export function handoffScheduledInteractivePageTurn(
  state: PageTurnSchedulerState,
  turnId: string,
  release: ReleasedPageTurnGesture,
  waitForLaneReady: boolean,
): PageTurnSchedulerState {
  let found = false;
  const turns = state.turns.map((turn) => {
    if (turn.id !== turnId || !turn.interactive || turn.completed) {
      return turn;
    }
    found = true;
    return {
      ...turn,
      interactive: false,
      handoffPending: waitForLaneReady,
      motion: "gesture" as const,
      gestureRelease: release,
    };
  });
  return found ? { ...state, turns } : state;
}

export function markScheduledPageTurnLaneReady(
  state: PageTurnSchedulerState,
  turnId: string,
): PageTurnSchedulerState {
  let found = false;
  const turns = state.turns.map((turn) => {
    if (turn.id !== turnId || !turn.handoffPending || turn.completed) {
      return turn;
    }
    found = true;
    return { ...turn, handoffPending: false };
  });
  return found ? { ...state, turns } : state;
}

export function resolveScheduledPageTurn(
  state: PageTurnSchedulerState,
  turnId: string,
  committed: boolean,
): PageTurnSchedulerState {
  const resolvedIndex = state.turns.findIndex((turn) => turn.id === turnId);
  if (resolvedIndex < 0 || state.turns[resolvedIndex]!.completed) {
    return state;
  }

  if (!committed) {
    // A failed interactive sheet invalidates anything chained after it.
    const reverted = state.turns[resolvedIndex]!;
    return collapseCompletedPrefix({
      settled: state.settled,
      desired: reverted.from,
      turns: state.turns.slice(0, resolvedIndex),
      nextTapStartAtMs: state.nextTapStartAtMs,
    });
  }

  const turns = state.turns.map((turn, index) =>
    index === resolvedIndex ? { ...turn, completed: true } : turn,
  );
  return collapseCompletedPrefix({ ...state, turns });
}

export function scheduledPageAddress(
  state: PageTurnSchedulerState,
): PageAddress {
  return state.turns.at(-1)?.to ?? state.settled;
}

export function hasRunningPageTurns(state: PageTurnSchedulerState): boolean {
  return state.turns.some((turn) => !turn.completed);
}

export function turnPageImmediately(
  state: PageTurnSchedulerState,
  direction: 1 | -1,
  adjacent: PageTurnScheduler["adjacent"],
): PageTurnSchedulerState {
  if (state.turns.length > 0) {
    return state;
  }
  const target = adjacent(state.settled, direction);
  return samePageAddress(target, state.settled)
    ? state
    : createPageTurnSchedulerState(target);
}

function tryStartScheduledTurn(
  state: PageTurnSchedulerState,
  direction: 1 | -1,
  scheduler: PageTurnScheduler,
  requestedAtMs: number,
  interactive: boolean,
  motion: "tap" | "gesture",
  gestureRelease?: ReleasedPageTurnGesture,
  respectThrottle = true,
): PageTurnSchedulerState {
  if (respectThrottle && requestedAtMs < state.nextTapStartAtMs) {
    return state;
  }

  const maximumConcurrentTurns = Math.min(
    PAGE_TURN_LANE_HARD_LIMIT,
    Math.max(
      1,
      Math.floor(scheduler.maximumConcurrentTurns ?? PAGE_TURN_LANE_HARD_LIMIT),
    ),
  );
  const occupiedLanes = new Set(state.turns.map((turn) => turn.lane));
  if (occupiedLanes.size >= maximumConcurrentTurns) {
    return state;
  }
  if (motion === "tap") {
    const maximumConcurrentTapTurns = Math.min(
      maximumConcurrentTurns,
      Math.max(
        1,
        Math.floor(
          scheduler.maximumConcurrentTapTurns ?? maximumConcurrentTurns,
        ),
      ),
    );
    const activeTapTurns = state.turns.filter(
      (turn) => turn.motion === "tap",
    ).length;
    if (activeTapTurns >= maximumConcurrentTapTurns) {
      return state;
    }
  }

  const lastTurn = state.turns.at(-1);
  if (lastTurn && lastTurn.direction !== direction) {
    return state;
  }
  const from = lastTurn?.to ?? state.settled;
  const to = scheduler.adjacent(from, direction);
  if (samePageAddress(to, from)) {
    return state;
  }

  const lane = firstFreeLane(occupiedLanes, maximumConcurrentTurns);
  if (lane < 0) {
    return state;
  }
  const minimumTurnIntervalMs = Math.max(
    0,
    scheduler.minimumTurnIntervalMs ?? PAGE_TURN_START_INTERVAL_MS,
  );
  return {
    settled: state.settled,
    desired: to,
    turns: [
      ...state.turns,
      createTurn(
        from,
        to,
        direction,
        lane,
        interactive,
        scheduler,
        motion,
        gestureRelease,
      ),
    ],
    nextTapStartAtMs:
      motion === "tap"
        ? requestedAtMs + minimumTurnIntervalMs
        : state.nextTapStartAtMs,
  };
}

function collapseCompletedPrefix(
  state: PageTurnSchedulerState,
): PageTurnSchedulerState {
  let settled = state.settled;
  let firstRunningIndex = 0;
  while (
    firstRunningIndex < state.turns.length &&
    state.turns[firstRunningIndex]!.completed
  ) {
    settled = state.turns[firstRunningIndex]!.to;
    firstRunningIndex += 1;
  }
  return {
    ...state,
    settled,
    turns: state.turns.slice(firstRunningIndex),
  };
}

function createTurn(
  from: PageAddress,
  to: PageAddress,
  direction: 1 | -1,
  lane: number,
  interactive: boolean,
  scheduler: PageTurnScheduler,
  motion: "tap" | "gesture" = "tap",
  gestureRelease?: ReleasedPageTurnGesture,
): ScheduledPageTurn {
  return {
    id: scheduler.createId(),
    from,
    to,
    direction,
    lane,
    interactive,
    handoffPending: false,
    motion,
    gestureRelease,
    completed: false,
  };
}

function firstFreeLane(
  occupied: ReadonlySet<number>,
  maximumConcurrentTurns: number,
): number {
  for (let lane = 0; lane < maximumConcurrentTurns; lane += 1) {
    if (!occupied.has(lane)) {
      return lane;
    }
  }
  return -1;
}
