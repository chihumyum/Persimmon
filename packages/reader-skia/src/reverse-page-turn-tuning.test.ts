import { describe, expect, it } from "vitest";

import { normalizeReverseAutomaticPageTurnTuning } from "./reverse-automatic-page-turn-tuning";
import {
  normalizeReverseGesturePageTurnTuning,
  normalizeReverseGesturePageTurnTuningForPlatform,
} from "./reverse-gesture-page-turn-tuning";

describe("reverse page turn tuning", () => {
  it("keeps reverse tap controls independent from forward propagation", () => {
    expect(normalizeReverseAutomaticPageTurnTuning(undefined)).toEqual({
      releaseX: 0.4,
      curvatureRelaxation: 10,
      incomingLandingStartProgress: 0.15,
      incomingRevealStartProgress: 0,
      incomingRevealEndProgress: 0.18,
      incomingSettleDurationSeconds: 0.7,
      incomingSettleEasingPower: 3,
      playbackSpeed: 1,
    });
    const normalized = normalizeReverseAutomaticPageTurnTuning({
      releaseX: 2,
      curvatureRelaxation: 40,
      incomingRevealStartProgress: 0.8,
      incomingRevealEndProgress: 0.1,
      playbackSpeed: 9,
    });
    expect(normalized).toMatchObject({
      releaseX: 0.95,
      curvatureRelaxation: 20,
      incomingRevealStartProgress: 0.8,
      playbackSpeed: 3,
    });
    expect(normalized.incomingRevealEndProgress).toBeCloseTo(0.82, 12);
  });

  it("widens reverse gesture bounds and clamps follow-hand controls", () => {
    expect(normalizeReverseGesturePageTurnTuning(undefined)).toEqual({
      releaseX: 0.6,
      curvatureRelaxation: 10,
      incomingLandingStartProgress: 0.15,
      incomingRevealStartProgress: 0,
      incomingRevealEndProgress: 0.1,
      incomingDragProgressScale: 1,
      incomingDragProgressExponent: 1,
      incomingSettleDurationSeconds: 0.7,
      incomingSettleEasingPower: 2,
      incomingRevertDurationSeconds: 0.7,
      pageWeight: 1,
      commitThreshold: 0.15,
      minimumSpeedScale: 0.8,
      maximumSpeedScale: 5,
      velocityGain: 0.2,
      idleDecaySeconds: 0.1,
    });
    expect(
      normalizeReverseGesturePageTurnTuning({
        releaseX: 0,
        incomingDragProgressScale: 9,
        incomingDragProgressExponent: 0,
        incomingRevertDurationSeconds: 9,
        pageWeight: 9,
        commitThreshold: 0,
        minimumSpeedScale: 9,
        maximumSpeedScale: 0,
        velocityGain: 9,
        idleDecaySeconds: 9,
      }),
    ).toMatchObject({
      releaseX: 0.25,
      incomingDragProgressScale: 3,
      incomingDragProgressExponent: 0.35,
      incomingRevertDurationSeconds: 1.5,
      pageWeight: 3,
      commitThreshold: 0.15,
      minimumSpeedScale: 4,
      maximumSpeedScale: 4,
      velocityGain: 4,
      idleDecaySeconds: 1,
    });
  });

  it("keeps the tuned reverse iOS threshold at the supported floor", () => {
    expect(
      normalizeReverseGesturePageTurnTuningForPlatform(undefined, "ios")
        .commitThreshold,
    ).toBe(0.15);
    expect(
      normalizeReverseGesturePageTurnTuningForPlatform(undefined, "android")
        .commitThreshold,
    ).toBe(0.15);
  });
});
