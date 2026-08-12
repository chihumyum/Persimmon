import type { ReleasedPageTurnGesture } from "@chihumyum/page-turn-core";

import { PAGE_TURN_LANE_HARD_LIMIT } from "./page-turn-concurrency";
import { samePageAddress, type PageAddress } from "./section-navigation";

/** Roughly 10 launches per second while preserving the two-lane burst budget. */
export const PAGE_TURN_START_INTERVAL_MS = 100;

export type ScheduledPageTurnMotion = "tap" | "rapid" | "gesture";

export function isProgrammaticPageTurnMotion(
  motion: ScheduledPageTurnMotion,
): boolean {
  return motion !== "gesture";
}

export interface ScheduledPageTurn {
  readonly id: string;
  readonly from: PageAddress;
  readonly to: PageAddress;
  readonly direction: 1 | -1;
  readonly lane: number;
  /**
   * UI-clock deadline for automatic launch. Rapid taps reserve successive
   * cadence slots instead of being discarded inside the throttle window.
   */
  readonly startAtMs: number;
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
  /**
   * Native sets this only after the lane has installed its first valid shared
   * frame. Until then the live source page must remain visible, otherwise the
   * target background can leak through for one frame.
   */
  readonly laneReady: boolean;
  /**
   * Native sets this only after React has committed the paper mesh and Skia
   * has had two presentation opportunities. Automatic animation time must not
   * advance before this barrier; a fixed preparation delay cannot guarantee
   * that a cold texture is visible.
   */
  readonly presentationReady: boolean;
  readonly motion: ScheduledPageTurnMotion;
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
 * Starts at most one turn for this input. Taps that arrive before the next
 * cadence boundary reserve that future UI-clock slot, so every accepted page
 * keeps uniform spacing. Full lane capacity and input against the current
 * stack direction are still rejected. Gestures bypass the tap cadence.
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

export function requestScheduledRapidPageTurn(
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
    "rapid",
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
    if (
      turn.id !== turnId ||
      turn.completed ||
      (turn.laneReady && !turn.handoffPending)
    ) {
      return turn;
    }
    found = true;
    return { ...turn, handoffPending: false, laneReady: true };
  });
  return found ? { ...state, turns } : state;
}

/**
 * Opens the native presentation gate for a source-order batch. If texture or
 * React work made a reserved cadence slot stale, shift this turn and every
 * later tap by the same amount. This preserves cadence spacing without letting
 * several overdue lanes catch up on one UI frame.
 */
export function markScheduledPageTurnsPresented(
  state: PageTurnSchedulerState,
  turnIds: readonly string[],
  presentedAtMs: number,
): PageTurnSchedulerState {
  if (turnIds.length === 0 || !Number.isFinite(presentedAtMs)) {
    return state;
  }
  const presentedIds = new Set(turnIds);
  let changed = false;
  let cumulativeShiftMs = 0;
  const turns = state.turns.map((turn) => {
    let startAtMs =
      isProgrammaticPageTurnMotion(turn.motion) && !turn.completed
        ? turn.startAtMs + cumulativeShiftMs
        : turn.startAtMs;
    let presentationReady = turn.presentationReady;
    if (
      presentedIds.has(turn.id) &&
      !turn.completed &&
      isProgrammaticPageTurnMotion(turn.motion) &&
      !turn.presentationReady
    ) {
      const overdueMs = Math.max(0, presentedAtMs - startAtMs);
      if (overdueMs > 0) {
        cumulativeShiftMs += overdueMs;
        startAtMs += overdueMs;
      }
      presentationReady = true;
      changed = true;
    }
    if (
      startAtMs === turn.startAtMs &&
      presentationReady === turn.presentationReady
    ) {
      return turn;
    }
    changed = true;
    return { ...turn, startAtMs, presentationReady };
  });
  return changed
    ? {
        ...state,
        turns,
        nextTapStartAtMs: state.nextTapStartAtMs + cumulativeShiftMs,
      }
    : state;
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
  motion: ScheduledPageTurnMotion,
  gestureRelease?: ReleasedPageTurnGesture,
  respectThrottle = true,
): PageTurnSchedulerState {
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
  if (isProgrammaticPageTurnMotion(motion)) {
    const maximumConcurrentTapTurns = Math.min(
      maximumConcurrentTurns,
      Math.max(
        1,
        Math.floor(
          scheduler.maximumConcurrentTapTurns ?? maximumConcurrentTurns,
        ),
      ),
    );
    const activeTapTurns = state.turns.filter((turn) =>
      isProgrammaticPageTurnMotion(turn.motion),
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
  const scheduledStartAtMs =
    isProgrammaticPageTurnMotion(motion) && respectThrottle
      ? Math.max(requestedAtMs, state.nextTapStartAtMs)
      : requestedAtMs;
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
        scheduledStartAtMs,
      ),
    ],
    nextTapStartAtMs: isProgrammaticPageTurnMotion(motion)
      ? scheduledStartAtMs + minimumTurnIntervalMs
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
  motion: ScheduledPageTurnMotion = "tap",
  gestureRelease?: ReleasedPageTurnGesture,
  startAtMs = 0,
): ScheduledPageTurn {
  return {
    id: scheduler.createId(),
    from,
    to,
    direction,
    lane,
    startAtMs,
    interactive,
    handoffPending: false,
    laneReady: false,
    presentationReady: false,
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
