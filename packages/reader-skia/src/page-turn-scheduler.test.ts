import { describe, expect, it } from "vitest";

import type { PageAddress } from "./section-navigation";
import { PAGE_TURN_LANE_HARD_LIMIT } from "./page-turn-concurrency";
import {
  PAGE_TURN_START_INTERVAL_MS,
  beginScheduledInteractivePageTurn,
  createPageTurnSchedulerState,
  handoffScheduledInteractivePageTurn,
  markScheduledPageTurnLaneReady,
  requestScheduledGesturePageTurn,
  requestScheduledPageTurn,
  resolveScheduledPageTurn,
  scheduledPageAddress,
  type PageTurnScheduler,
} from "./page-turn-scheduler";

function createHarness(pageCount = 20) {
  let id = 0;
  const scheduler: PageTurnScheduler = {
    adjacent: (address, direction) => ({
      sectionIndex: 0,
      pageIndex: Math.min(
        pageCount - 1,
        Math.max(0, address.pageIndex + direction),
      ),
    }),
    createId: () => `turn:${++id}`,
  };
  return scheduler;
}

function page(pageIndex: number): PageAddress {
  return { sectionIndex: 0, pageIndex };
}

const release = {
  pressedEdgeX: 0.25,
  heldRollTilt: 0.8,
  speedScale: 1.8,
  turnProgress: 0.35,
  settlingProgress: 0.6,
};

describe("page-turn scheduler", () => {
  it("launches a normal edge turn immediately", () => {
    const scheduler = createHarness();
    const state = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );

    expect(state.desired).toEqual(page(1));
    expect(state.nextTurnStartAtMs).toBe(PAGE_TURN_START_INTERVAL_MS);
    expect(state.turns).toMatchObject([
      {
        id: "turn:1",
        from: page(0),
        to: page(1),
        direction: 1,
        lane: 0,
        interactive: false,
        handoffPending: false,
        completed: false,
      },
    ]);
  });

  it("uniformly throttles tap starts to one every 150 ms", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    for (const requestedAtMs of [0, 149, 150, 299, 300, 449, 450]) {
      state = requestScheduledPageTurn(state, 1, scheduler, requestedAtMs);
    }

    expect(state.turns).toHaveLength(4);
    expect(state.turns.map((turn) => turn.from.pageIndex)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(state.turns.map((turn) => turn.lane)).toEqual([0, 1, 2, 3]);
    expect(state.desired).toEqual(page(4));
  });

  it("drops an instantaneous burst instead of replaying it later", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    for (let index = 0; index < 10; index += 1) {
      state = requestScheduledPageTurn(state, 1, scheduler, 100);
    }

    expect(state.turns).toHaveLength(1);
    expect(state.desired).toEqual(page(1));

    state = resolveScheduledPageTurn(state, "turn:1", true);
    expect(state.turns).toHaveLength(0);
    expect(state.settled).toEqual(page(1));
  });

  it("drops input at capacity and reuses a lane only for a later input", () => {
    const scheduler = createHarness(PAGE_TURN_LANE_HARD_LIMIT + 2);
    let state = createPageTurnSchedulerState(page(0));
    for (let index = 0; index < PAGE_TURN_LANE_HARD_LIMIT; index += 1) {
      state = requestScheduledPageTurn(
        state,
        1,
        scheduler,
        index * PAGE_TURN_START_INTERVAL_MS,
      );
    }

    const atCapacity = requestScheduledPageTurn(
      state,
      1,
      scheduler,
      PAGE_TURN_LANE_HARD_LIMIT * PAGE_TURN_START_INTERVAL_MS,
    );
    expect(atCapacity).toBe(state);
    expect(state.desired).toEqual(page(PAGE_TURN_LANE_HARD_LIMIT));

    state = resolveScheduledPageTurn(state, "turn:1", true);
    state = requestScheduledPageTurn(
      state,
      1,
      scheduler,
      (PAGE_TURN_LANE_HARD_LIMIT + 1) * PAGE_TURN_START_INTERVAL_MS,
    );
    expect(state.turns.at(-1)).toMatchObject({
      id: `turn:${PAGE_TURN_LANE_HARD_LIMIT + 1}`,
      from: page(PAGE_TURN_LANE_HARD_LIMIT),
      to: page(PAGE_TURN_LANE_HARD_LIMIT + 1),
      lane: 0,
    });
  });

  it("supports uniformly spaced backward turns", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(10));
    for (let index = 0; index < PAGE_TURN_LANE_HARD_LIMIT; index += 1) {
      state = requestScheduledPageTurn(
        state,
        -1,
        scheduler,
        index * PAGE_TURN_START_INTERVAL_MS,
      );
    }

    expect(state.turns.map((turn) => turn.from.pageIndex)).toEqual([
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(scheduledPageAddress(state)).toEqual(page(0));
  });

  it("reserves the dynamically calculated spare lane for a gesture", () => {
    const scheduler = {
      ...createHarness(),
      maximumConcurrentTurns: 6,
      maximumConcurrentTapTurns: 5,
    };
    let state = createPageTurnSchedulerState(page(0));
    for (let index = 0; index < 6; index += 1) {
      state = requestScheduledPageTurn(
        state,
        1,
        scheduler,
        index * PAGE_TURN_START_INTERVAL_MS,
      );
    }

    expect(state.turns).toHaveLength(5);
    state = beginScheduledInteractivePageTurn(
      state,
      1,
      scheduler,
      6 * PAGE_TURN_START_INTERVAL_MS,
    );
    expect(state.turns).toHaveLength(6);
    expect(state.turns.at(-1)).toMatchObject({
      lane: 5,
      interactive: true,
      motion: "gesture",
    });
  });

  it("collapses out-of-order completions only after predecessors land", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    state = requestScheduledPageTurn(state, 1, scheduler, 0);
    state = requestScheduledPageTurn(state, 1, scheduler, 250);
    state = requestScheduledPageTurn(state, 1, scheduler, 500);

    state = resolveScheduledPageTurn(state, "turn:3", true);
    expect(state.settled).toEqual(page(0));
    expect(state.turns[2]?.completed).toBe(true);

    state = resolveScheduledPageTurn(state, "turn:1", true);
    expect(state.settled).toEqual(page(1));

    state = resolveScheduledPageTurn(state, "turn:2", true);
    expect(state.settled).toEqual(page(3));
    expect(state.turns).toEqual([]);
  });

  it("drops an opposite direction instead of queueing it", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(4));
    state = requestScheduledPageTurn(state, 1, scheduler, 0);
    const unchanged = requestScheduledPageTurn(state, -1, scheduler, 250);

    expect(unchanged).toBe(state);
    expect(state.desired).toEqual(page(5));

    state = resolveScheduledPageTurn(state, "turn:1", true);
    expect(state.turns).toEqual([]);
    expect(state.settled).toEqual(page(5));
  });

  it("hands a released drag to its lane before accepting the next drag", () => {
    const scheduler = createHarness();
    let state = beginScheduledInteractivePageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );
    state = handoffScheduledInteractivePageTurn(state, "turn:1", release, true);

    expect(state.turns[0]).toMatchObject({
      interactive: false,
      handoffPending: true,
      motion: "gesture",
      gestureRelease: release,
    });
    expect(beginScheduledInteractivePageTurn(state, 1, scheduler, 250)).toBe(
      state,
    );

    state = markScheduledPageTurnLaneReady(state, "turn:1");
    state = beginScheduledInteractivePageTurn(state, 1, scheduler, 250);
    expect(state.turns).toMatchObject([
      { lane: 0, interactive: false, handoffPending: false },
      { lane: 1, interactive: true, handoffPending: false },
    ]);
  });

  it("lets a new finger claim a free lane without waiting for the tap throttle", () => {
    const scheduler = createHarness();
    let state = beginScheduledInteractivePageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );
    state = handoffScheduledInteractivePageTurn(
      state,
      "turn:1",
      release,
      false,
    );
    state = beginScheduledInteractivePageTurn(state, 1, scheduler, 100);

    expect(state.turns).toMatchObject([
      { id: "turn:1", lane: 0, interactive: false },
      { id: "turn:2", lane: 1, interactive: true },
    ]);
    expect(state.nextTurnStartAtMs).toBe(100 + PAGE_TURN_START_INTERVAL_MS);
  });

  it("keeps rapid flicks in gesture lanes and drops excess releases", () => {
    const scheduler = createHarness(PAGE_TURN_LANE_HARD_LIMIT + 2);
    let state = createPageTurnSchedulerState(page(0));
    for (let index = 0; index < PAGE_TURN_LANE_HARD_LIMIT + 2; index += 1) {
      state = requestScheduledGesturePageTurn(
        state,
        1,
        release,
        scheduler,
        index * PAGE_TURN_START_INTERVAL_MS,
      );
    }

    expect(state.turns).toHaveLength(PAGE_TURN_LANE_HARD_LIMIT);
    expect(state.turns.map((turn) => turn.lane)).toEqual(
      Array.from({ length: PAGE_TURN_LANE_HARD_LIMIT }, (_, lane) => lane),
    );
    expect(state.turns.every((turn) => turn.motion === "gesture")).toBe(true);
    expect(state.turns.every((turn) => turn.gestureRelease === release)).toBe(
      true,
    );
    expect(state.desired).toEqual(page(PAGE_TURN_LANE_HARD_LIMIT));
  });
});
