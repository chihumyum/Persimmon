import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_PAGE_TURN_TUNING,
  normalizeGesturePageTurnTuning,
  normalizeGesturePageTurnTuningForPlatform,
} from "./gesture-page-turn-tuning";

describe("gesture page turn tuning", () => {
  it("uses the tuned product constants as stable defaults", () => {
    expect(normalizeGesturePageTurnTuning(undefined)).toEqual({
      releaseX: 0.4,
      liftVelocity: 1,
      liftToLeft: 1,
      curvatureRelaxation: 10,
      pageWeight: 1,
      commitThreshold: 0.8,
      minimumSpeedScale: 1,
      maximumSpeedScale: 5,
      velocityGain: 0.2,
      idleDecaySeconds: 0.1,
    });
  });

  it("clamps gesture release and commit constants", () => {
    expect(
      normalizeGesturePageTurnTuning({
        releaseX: 2,
        curvatureRelaxation: 100,
        pageWeight: 0,
        commitThreshold: 100,
        minimumSpeedScale: 10,
        maximumSpeedScale: 0.5,
        velocityGain: 100,
        idleDecaySeconds: 10,
      }),
    ).toEqual({
      ...DEFAULT_GESTURE_PAGE_TURN_TUNING,
      releaseX: 1,
      curvatureRelaxation: 40,
      pageWeight: 0.1,
      commitThreshold: 3,
      minimumSpeedScale: 4,
      maximumSpeedScale: 4,
      velocityGain: 4,
      idleDecaySeconds: 1,
    });
  });

  it("uses 80% of the Android commit threshold on iOS", () => {
    const androidThreshold = normalizeGesturePageTurnTuningForPlatform(
      undefined,
      "android",
    ).commitThreshold;
    const iosThreshold = normalizeGesturePageTurnTuningForPlatform(
      undefined,
      "ios",
    ).commitThreshold;
    expect(androidThreshold).toBe(0.8);
    expect(iosThreshold).toBeCloseTo(androidThreshold * 0.8, 12);
    expect(
      normalizeGesturePageTurnTuningForPlatform(undefined, "android"),
    ).toEqual(DEFAULT_GESTURE_PAGE_TURN_TUNING);

    const customAndroidThreshold = normalizeGesturePageTurnTuningForPlatform(
      { commitThreshold: 1.25 },
      "android",
    ).commitThreshold;
    const customIosThreshold = normalizeGesturePageTurnTuningForPlatform(
      { commitThreshold: 1.25 },
      "ios",
    ).commitThreshold;
    expect(customIosThreshold).toBeCloseTo(customAndroidThreshold * 0.8, 12);
  });
});
