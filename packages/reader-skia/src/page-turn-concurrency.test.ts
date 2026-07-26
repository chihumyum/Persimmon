import { describe, expect, it } from "vitest";

import { DEFAULT_AUTOMATIC_PAGE_TURN_TUNING } from "./automatic-page-turn-tuning";
import {
  PAGE_TURN_LANE_HARD_LIMIT,
  PAGE_TURN_TAP_LANE_HEADROOM,
  calculatePageTurnConcurrency,
} from "./page-turn-concurrency";

describe("page turn concurrency", () => {
  it("adds two completion-headroom lanes to the three default overlaps", () => {
    expect(
      calculatePageTurnConcurrency(DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, 150),
    ).toEqual({
      estimatedTapDurationMs: 441,
      minimumTurnIntervalMs: 150,
      maximumConcurrentTapTurns: 5,
      maximumConcurrentTurns: 6,
    });
  });

  it("tracks playback speed without exceeding the hard pool", () => {
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 2 },
        150,
      ),
    ).toMatchObject({
      estimatedTapDurationMs: 287,
      minimumTurnIntervalMs: 150,
      maximumConcurrentTapTurns: 4,
      maximumConcurrentTurns: 5,
    });
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 0.5 },
        150,
      ),
    ).toMatchObject({
      estimatedTapDurationMs: 1147,
      minimumTurnIntervalMs: 230,
      maximumConcurrentTapTurns: 7,
      maximumConcurrentTurns: 8,
    });
  });

  it("raises the start interval instead of producing a capacity gap", () => {
    const result = calculatePageTurnConcurrency(
      {
        ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
        releaseX: 0.8,
        liftVelocity: 0.7,
        liftToLeft: 1.4,
        playbackSpeed: 0.5,
      },
      150,
    );

    expect(result).toMatchObject({
      estimatedTapDurationMs: 3435,
      minimumTurnIntervalMs: 687,
      maximumConcurrentTapTurns: PAGE_TURN_LANE_HARD_LIMIT - 1,
      maximumConcurrentTurns: PAGE_TURN_LANE_HARD_LIMIT,
    });
    expect(
      Math.ceil(result.estimatedTapDurationMs / result.minimumTurnIntervalMs) +
        PAGE_TURN_TAP_LANE_HEADROOM,
    ).toBeLessThanOrEqual(result.maximumConcurrentTapTurns);
  });

  it("derives a capacity-safe interval from a non-positive request", () => {
    expect(
      calculatePageTurnConcurrency(DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, 0),
    ).toMatchObject({
      minimumTurnIntervalMs: 89,
      maximumConcurrentTapTurns: PAGE_TURN_LANE_HARD_LIMIT - 1,
      maximumConcurrentTurns: PAGE_TURN_LANE_HARD_LIMIT,
    });
  });
});
