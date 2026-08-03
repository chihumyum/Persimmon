import { describe, expect, it } from "vitest";

import type { PageAddress } from "./section-navigation";
import { PAGE_TURN_LANE_HARD_LIMIT } from "./page-turn-concurrency";
import {
  PAGE_TURN_START_INTERVAL_MS,
  beginScheduledInteractivePageTurn,
  createPageTurnSchedulerState,
  handoffScheduledInteractivePageTurn,
  markScheduledPageTurnLaneReady,
  markScheduledPageTurnsPresented,
  requestScheduledGesturePageTurn,
  requestScheduledPageTurn,
  requestScheduledRapidPageTurn,
  resolveScheduledPageTurn,
  turnPageImmediately,
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
  it("settles an animation-free turn immediately without creating a lane", () => {
    const state = createPageTurnSchedulerState({
      sectionIndex: 0,
      pageIndex: 1,
    });
    const next = turnPageImmediately(state, 1, (address, direction) => ({
      ...address,
      pageIndex: Math.max(0, address.pageIndex + direction),
    }));

    expect(next).toEqual({
      settled: { sectionIndex: 0, pageIndex: 2 },
      desired: { sectionIndex: 0, pageIndex: 2 },
      turns: [],
      nextTapStartAtMs: 0,
    });
  });

  it("does not interrupt a running turn or move past a boundary", () => {
    const scheduler = createHarness(2);
    const atEnd = createPageTurnSchedulerState(page(1));
    expect(turnPageImmediately(atEnd, 1, scheduler.adjacent)).toBe(atEnd);

    const running = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );
    expect(turnPageImmediately(running, -1, scheduler.adjacent)).toBe(running);
  });

  it("launches a normal edge turn immediately", () => {
    const scheduler = createHarness();
    const state = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );

    expect(state.desired).toEqual(page(1));
    expect(state.nextTapStartAtMs).toBe(PAGE_TURN_START_INTERVAL_MS);
    expect(state.turns).toMatchObject([
      {
        id: "turn:1",
        from: page(0),
        to: page(1),
        direction: 1,
        lane: 0,
        startAtMs: 0,
        interactive: false,
        handoffPending: false,
        laneReady: false,
        presentationReady: false,
        completed: false,
      },
    ]);
  });

  it("tags rapid turns independently while sharing programmatic cadence", () => {
    const scheduler = createHarness();
    let state = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );
    state = requestScheduledRapidPageTurn(state, 1, scheduler, 10);

    expect(state.turns).toMatchObject([
      { id: "turn:1", motion: "tap", startAtMs: 0 },
      {
        id: "turn:2",
        motion: "rapid",
        startAtMs: PAGE_TURN_START_INTERVAL_MS,
      },
    ]);
  });

  it("waits for a programmatic lane to install its first frame", () => {
    const scheduler = createHarness();
    let state = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );

    expect(state.turns[0]?.laneReady).toBe(false);
    state = markScheduledPageTurnLaneReady(state, "turn:1");
    expect(state.turns[0]).toMatchObject({
      handoffPending: false,
      laneReady: true,
    });
  });

  it("starts only after presentation and shifts every later cadence slot", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    state = requestScheduledPageTurn(state, 1, scheduler, 0);
    state = requestScheduledPageTurn(state, 1, scheduler, 100);
    state = requestScheduledPageTurn(state, 1, scheduler, 200);
    state = markScheduledPageTurnLaneReady(state, "turn:1");
    state = markScheduledPageTurnLaneReady(state, "turn:2");
    state = markScheduledPageTurnLaneReady(state, "turn:3");

    state = markScheduledPageTurnsPresented(state, ["turn:1", "turn:2"], 80);
    expect(state.turns.map((turn) => turn.startAtMs)).toEqual([80, 180, 280]);
    expect(state.turns.map((turn) => turn.presentationReady)).toEqual([
      true,
      true,
      false,
    ]);
    expect(state.nextTapStartAtMs).toBe(3 * PAGE_TURN_START_INTERVAL_MS + 80);

    state = markScheduledPageTurnsPresented(state, ["turn:3"], 350);
    expect(state.turns.map((turn) => turn.startAtMs)).toEqual([80, 180, 350]);
    expect(state.turns.every((turn) => turn.presentationReady)).toBe(true);
    expect(state.nextTapStartAtMs).toBe(3 * PAGE_TURN_START_INTERVAL_MS + 150);
  });

  it("does not reopen or reschedule an acknowledged presentation gate", () => {
    const scheduler = createHarness();
    let state = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );
    state = markScheduledPageTurnsPresented(state, ["turn:1"], 75);

    expect(markScheduledPageTurnsPresented(state, ["turn:1"], 500)).toBe(state);
    expect(state.turns[0]).toMatchObject({
      startAtMs: 75,
      presentationReady: true,
    });
  });

  it("queues early taps into uniform future cadence slots", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    for (const requestedAtMs of [0, 149, 150, 299, 300, 449, 450]) {
      state = requestScheduledPageTurn(state, 1, scheduler, requestedAtMs);
    }

    expect(state.turns).toHaveLength(7);
    expect(state.turns.map((turn) => turn.from.pageIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(state.turns.map((turn) => turn.lane)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(state.turns.map((turn) => turn.startAtMs)).toEqual([
      0, 149, 249, 349, 449, 549, 649,
    ]);
    expect(state.desired).toEqual(page(7));
  });

  it("bounds an instantaneous queued burst by physical lane capacity", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    for (let index = 0; index < PAGE_TURN_LANE_HARD_LIMIT + 1; index += 1) {
      state = requestScheduledPageTurn(state, 1, scheduler, 100);
    }

    expect(state.turns).toHaveLength(PAGE_TURN_LANE_HARD_LIMIT);
    expect(state.turns.map((turn) => turn.startAtMs)).toEqual(
      Array.from(
        { length: PAGE_TURN_LANE_HARD_LIMIT },
        (_, index) => 100 + index * PAGE_TURN_START_INTERVAL_MS,
      ),
    );
    expect(state.desired).toEqual(page(PAGE_TURN_LANE_HARD_LIMIT));

    state = resolveScheduledPageTurn(state, "turn:1", true);
    expect(state.turns).toHaveLength(PAGE_TURN_LANE_HARD_LIMIT - 1);
    expect(state.settled).toEqual(page(1));
  });

  it("does not apply the tap launch interval to gesture flicks", () => {
    const scheduler = {
      ...createHarness(),
      minimumTurnIntervalMs: 687,
    };
    let state = requestScheduledPageTurn(
      createPageTurnSchedulerState(page(0)),
      1,
      scheduler,
      0,
    );
    state = requestScheduledGesturePageTurn(state, 1, release, scheduler, 100);

    expect(state.turns).toMatchObject([
      { id: "turn:1", motion: "tap" },
      { id: "turn:2", motion: "gesture" },
    ]);
    expect(state.nextTapStartAtMs).toBe(687);
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
    let state = createPageTurnSchedulerState(page(PAGE_TURN_LANE_HARD_LIMIT));
    for (let index = 0; index < PAGE_TURN_LANE_HARD_LIMIT; index += 1) {
      state = requestScheduledPageTurn(
        state,
        -1,
        scheduler,
        index * PAGE_TURN_START_INTERVAL_MS,
      );
    }

    expect(state.turns.map((turn) => turn.from.pageIndex)).toEqual(
      Array.from(
        { length: PAGE_TURN_LANE_HARD_LIMIT },
        (_, index) => PAGE_TURN_LANE_HARD_LIMIT - index,
      ),
    );
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

  it("advances the settled background as completed prefixes land", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(0));
    state = requestScheduledPageTurn(state, 1, scheduler, 0);
    state = requestScheduledPageTurn(state, 1, scheduler, 250);
    state = requestScheduledPageTurn(state, 1, scheduler, 500);

    state = resolveScheduledPageTurn(state, "turn:3", true);
    expect(state.settled).toEqual(page(0));
    expect(state.turns[2]?.completed).toBe(true);

    state = requestScheduledPageTurn(state, 1, scheduler, 750);
    expect(state.turns.at(-1)).toMatchObject({
      id: "turn:4",
      lane: 3,
    });

    state = resolveScheduledPageTurn(state, "turn:1", true);
    expect(state.settled).toEqual(page(1));
    expect(state.turns[0]?.id).toBe("turn:2");

    state = resolveScheduledPageTurn(state, "turn:2", true);
    expect(state.settled).toEqual(page(3));
    expect(state.turns).toMatchObject([{ id: "turn:4", completed: false }]);

    state = resolveScheduledPageTurn(state, "turn:4", true);
    expect(state.settled).toEqual(page(4));
    expect(state.turns).toEqual([]);
  });

  it("keeps a landed non-prefix tap inside the tap allowance", () => {
    const scheduler = {
      ...createHarness(),
      maximumConcurrentTurns: 3,
      maximumConcurrentTapTurns: 2,
    };
    let state = createPageTurnSchedulerState(page(0));
    state = requestScheduledPageTurn(state, 1, scheduler, 0);
    state = requestScheduledPageTurn(state, 1, scheduler, 200);
    state = resolveScheduledPageTurn(state, "turn:2", true);

    expect(requestScheduledPageTurn(state, 1, scheduler, 400)).toBe(state);
    state = beginScheduledInteractivePageTurn(state, 1, scheduler, 400);
    expect(state.turns.at(-1)).toMatchObject({
      id: "turn:3",
      lane: 2,
      motion: "gesture",
    });
  });

  it("keeps the backward landing background current during a burst", () => {
    const scheduler = createHarness();
    let state = createPageTurnSchedulerState(page(10));
    state = requestScheduledPageTurn(state, -1, scheduler, 0);
    state = requestScheduledPageTurn(state, -1, scheduler, 250);
    state = requestScheduledPageTurn(state, -1, scheduler, 500);

    state = resolveScheduledPageTurn(state, "turn:1", true);

    expect(state.settled).toEqual(page(9));
    expect(state.turns).toMatchObject([
      { id: "turn:2", completed: false },
      { id: "turn:3", completed: false },
    ]);

    state = resolveScheduledPageTurn(state, "turn:2", true);
    expect(state.settled).toEqual(page(8));
    expect(state.turns[0]?.id).toBe("turn:3");

    state = resolveScheduledPageTurn(state, "turn:3", true);
    expect(state.settled).toEqual(page(7));
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
      {
        lane: 0,
        interactive: false,
        handoffPending: false,
        laneReady: true,
      },
      {
        lane: 1,
        interactive: true,
        handoffPending: false,
        laneReady: false,
      },
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
    expect(state.nextTapStartAtMs).toBe(0);
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
