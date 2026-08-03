import { describe, expect, it } from "vitest";

import { DEFAULT_AUTOMATIC_PAGE_TURN_TUNING } from "./automatic-page-turn-tuning";
import {
  PAGE_TURN_BURST_TARGET_DURATION_MS,
  PAGE_TURN_LANE_HARD_LIMIT,
  PAGE_TURN_TAP_LANE_HEADROOM,
  burstPageTurnPlaybackSpeed,
  calculatePageTurnConcurrency,
  estimateAutomaticPageTurnDurationMs,
} from "./page-turn-concurrency";

describe("page turn concurrency", () => {
  it("accounts for the prepended incoming-page reveal lifetime", () => {
    expect(
      estimateAutomaticPageTurnDurationMs(
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
        1,
      ),
    ).toBe(441);
    expect(
      estimateAutomaticPageTurnDurationMs(
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
        -1,
      ),
    ).toBe(556);
    expect(
      estimateAutomaticPageTurnDurationMs(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, releaseX: 1 },
        1,
        1,
      ),
    ).toBeGreaterThan(
      estimateAutomaticPageTurnDurationMs(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, releaseX: 1 },
        1,
      ),
    );
  });

  it("sizes the pool from the compressed burst duration", () => {
    expect(
      calculatePageTurnConcurrency(DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, 150),
    ).toEqual({
      estimatedTapDurationMs: 556,
      minimumTurnIntervalMs: 150,
      maximumConcurrentTapTurns: 10,
      maximumConcurrentTurns: 11,
    });
  });

  it("keeps slow single-turn tuning from inflating the burst pool", () => {
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 2 },
        150,
      ),
    ).toMatchObject({
      estimatedTapDurationMs: 362,
      minimumTurnIntervalMs: 150,
      maximumConcurrentTapTurns: 10,
      maximumConcurrentTurns: 11,
    });
    expect(
      calculatePageTurnConcurrency(
        { ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, playbackSpeed: 0.5 },
        150,
      ),
    ).toMatchObject({
      estimatedTapDurationMs: 1445,
      minimumTurnIntervalMs: 150,
      maximumConcurrentTapTurns: 10,
      maximumConcurrentTurns: 11,
    });
  });

  it("compresses pathological tap tuning instead of stretching the cadence", () => {
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
      minimumTurnIntervalMs: 150,
      maximumConcurrentTapTurns: 10,
      maximumConcurrentTurns: 11,
    });
    expect(
      Math.ceil(
        PAGE_TURN_BURST_TARGET_DURATION_MS / result.minimumTurnIntervalMs,
      ) + PAGE_TURN_TAP_LANE_HEADROOM,
    ).toBeLessThanOrEqual(result.maximumConcurrentTapTurns);
  });

  it("derives a capacity-safe interval from a non-positive request", () => {
    expect(
      calculatePageTurnConcurrency(DEFAULT_AUTOMATIC_PAGE_TURN_TUNING, 0),
    ).toMatchObject({
      minimumTurnIntervalMs: 80,
      maximumConcurrentTapTurns: PAGE_TURN_LANE_HARD_LIMIT - 1,
      maximumConcurrentTurns: PAGE_TURN_LANE_HARD_LIMIT,
    });
  });

  it("accelerates overlapping turns into the burst duration without lowering quality", () => {
    const tuning = {
      ...DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
      playbackSpeed: 0.5,
    };
    const playbackSpeed = burstPageTurnPlaybackSpeed(tuning);
    const compressedDuration =
      (estimateAutomaticPageTurnDurationMs(tuning) * tuning.playbackSpeed) /
      playbackSpeed;

    expect(playbackSpeed).toBeGreaterThan(tuning.playbackSpeed);
    expect(compressedDuration).toBeLessThanOrEqual(
      PAGE_TURN_BURST_TARGET_DURATION_MS + 1,
    );
    expect(burstPageTurnPlaybackSpeed(tuning, 1)).toBe(playbackSpeed);
  });
});
