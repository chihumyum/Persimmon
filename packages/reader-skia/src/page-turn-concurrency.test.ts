import { describe, expect, it } from "vitest";

import { DEFAULT_AUTOMATIC_PAGE_TURN_TUNING } from "./automatic-page-turn-tuning";
import {
  PAGE_TURN_LANE_HARD_LIMIT,
  calculatePageTurnConcurrency,
} from "./page-turn-concurrency";

describe("page turn concurrency", () => {
  it("keeps two overlap windows for default animation and 150 ms starts", () => {
    expect(
      calculatePageTurnConcurrency(DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, 150),
    ).toEqual({
      estimatedTapDurationMs: 674,
      maximumConcurrentTapTurns: 10,
      maximumConcurrentTurns: 11,
    });
  });

  it("tracks playback speed without exceeding the hard pool", () => {
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 2 },
        150,
      ),
    ).toMatchObject({
      estimatedTapDurationMs: 337,
      maximumConcurrentTapTurns: 6,
      maximumConcurrentTurns: 7,
    });
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 0.5 },
        150,
      ),
    ).toMatchObject({
      estimatedTapDurationMs: 1348,
      maximumConcurrentTapTurns: 18,
      maximumConcurrentTurns: 19,
    });
  });

  it("caps doubled timing headroom at the hard pool limit", () => {
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 0.25 },
        150,
      ),
    ).toMatchObject({
      maximumConcurrentTapTurns: PAGE_TURN_LANE_HARD_LIMIT - 1,
      maximumConcurrentTurns: PAGE_TURN_LANE_HARD_LIMIT,
    });
  });

  it("uses the hard limit for a non-positive interval", () => {
    expect(
      calculatePageTurnConcurrency(DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, 0),
    ).toMatchObject({
      maximumConcurrentTapTurns: PAGE_TURN_LANE_HARD_LIMIT - 1,
      maximumConcurrentTurns: PAGE_TURN_LANE_HARD_LIMIT,
    });
  });
});
