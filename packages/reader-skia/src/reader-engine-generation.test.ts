import { describe, expect, it } from "vitest";

import { requestScheduledPageTurn } from "./page-turn-scheduler";
import {
  createReaderEngineGeneration,
  reconcileReaderEngineGeneration,
} from "./reader-engine-generation";

describe("reader engine generation", () => {
  it("retains scheduler state while the render generation is unchanged", () => {
    const initial = createReaderEngineGeneration("single", {
      sectionIndex: 1,
      pageIndex: 4,
    });

    expect(
      reconcileReaderEngineGeneration(initial, "single", {
        sectionIndex: 0,
        pageIndex: 0,
      }),
    ).toBe(initial);
  });

  it("drops in-flight turns and starts from the remapped locator on change", () => {
    const initial = createReaderEngineGeneration("single", {
      sectionIndex: 0,
      pageIndex: 3,
    });
    const withTurn = {
      ...initial,
      scheduler: requestScheduledPageTurn(
        initial.scheduler,
        1,
        {
          adjacent: (address, direction) => ({
            ...address,
            pageIndex: address.pageIndex + direction,
          }),
          createId: () => "turn:1",
          maximumConcurrentTurns: 1,
          maximumConcurrentTapTurns: 1,
          minimumTurnIntervalMs: 0,
        },
        100,
      ),
    };

    expect(withTurn.scheduler.turns).toHaveLength(1);

    const spread = reconcileReaderEngineGeneration(withTurn, "spread", {
      sectionIndex: 0,
      pageIndex: 7,
    });

    expect(spread).not.toBe(withTurn);
    expect(spread.scheduler).toEqual({
      settled: { sectionIndex: 0, pageIndex: 7 },
      desired: { sectionIndex: 0, pageIndex: 7 },
      turns: [],
      nextTapStartAtMs: 0,
    });
  });
});
