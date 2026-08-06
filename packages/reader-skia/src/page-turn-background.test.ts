import { describe, expect, it } from "vitest";

import {
  pageTurnBackgroundSlots,
  pageTurnsReadyForPaint,
} from "./page-turn-background";
import type { PageAddress } from "./section-navigation";

function page(pageIndex: number): PageAddress {
  return { sectionIndex: 0, pageIndex };
}

describe("page-turn burst background", () => {
  it("keeps the live page until the native lane installs its first frame", () => {
    const waiting = {
      completed: false,
      handoffPending: false,
      interactive: false,
      laneReady: false,
    };
    const ready = { ...waiting, laneReady: true };

    expect(pageTurnsReadyForPaint([waiting])).toEqual([]);
    expect(pageTurnsReadyForPaint([ready])).toEqual([ready]);
  });

  it("does not paint a later lane before an earlier native lane", () => {
    const waiting = {
      completed: false,
      handoffPending: false,
      interactive: false,
      laneReady: false,
    };
    const ready = { ...waiting, laneReady: true };

    expect(pageTurnsReadyForPaint([waiting, ready])).toEqual([]);
  });

  it("keeps an interactive frame visible while it hands off", () => {
    const interactive = {
      completed: false,
      handoffPending: false,
      interactive: true,
      laneReady: false,
    };
    const handoff = {
      ...interactive,
      handoffPending: true,
      interactive: false,
    };

    expect(pageTurnsReadyForPaint([interactive, handoff])).toEqual([
      interactive,
      handoff,
    ]);
  });

  it("reveals the newest target under a forward single-page turn", () => {
    expect(pageTurnBackgroundSlots("single", 1, [page(6)], [page(9)])).toEqual([
      page(9),
    ]);
  });

  it("keeps the oldest source under a backward single-page turn", () => {
    expect(pageTurnBackgroundSlots("single", -1, [page(9)], [page(6)])).toEqual(
      [page(9)],
    );
  });

  it("uses the oldest active right page under concurrent backward turns", () => {
    expect(
      pageTurnBackgroundSlots(
        "spread",
        -1,
        [page(8), page(9)],
        [page(4), page(5)],
      ),
    ).toEqual([page(4), page(9)]);
  });

  it("uses the oldest active left page under concurrent forward turns", () => {
    expect(
      pageTurnBackgroundSlots(
        "spread",
        1,
        [page(6), page(7)],
        [page(10), page(11)],
      ),
    ).toEqual([page(6), page(11)]);
  });
});
