import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_PAGE_TURN_TUNING,
  normalizeGesturePageTurnTuning,
  normalizeGesturePageTurnTuningForPlatform,
} from "./gesture-page-turn-tuning";

describe("gesture page turn tuning", () => {
  it("uses the tuned product constants as stable defaults", () => {
    expect(normalizeGesturePageTurnTuning(undefined)).toEqual({
      releaseX: 0.69,
      liftVelocity: 0.9,
      liftToLeft: 1.65,
      curvatureRelaxation: 7,
      pageWeight: 0.6,
      commitThreshold: 0.53,
      minimumSpeedScale: 0.95,
      maximumSpeedScale: 2,
      velocityGain: 0.6,
      idleDecaySeconds: 0.09,
    });
  });

  it("clamps gesture release and commit constants", () => {
    expect(
      normalizeGesturePageTurnTuning({
        releaseX: 2,
        curvatureRelaxation: 20,
        pageWeight: 0,
        commitThreshold: 2,
        minimumSpeedScale: 1.4,
        maximumSpeedScale: 0.5,
        velocityGain: 0,
        idleDecaySeconds: 1,
      }),
    ).toEqual({
      ...DEFAULT_GESTURE_PAGE_TURN_TUNING,
      releaseX: 0.8,
      curvatureRelaxation: 14,
      pageWeight: 0.5,
      commitThreshold: 1.2,
      minimumSpeedScale: 1.4,
      maximumSpeedScale: 1.4,
      velocityGain: 0.1,
      idleDecaySeconds: 0.2,
    });
  });

  it("reduces only the iOS commit threshold by one third", () => {
    expect(
      normalizeGesturePageTurnTuningForPlatform(undefined, "ios")
        .commitThreshold,
    ).toBeCloseTo((0.53 * 2) / 3, 12);
    expect(
      normalizeGesturePageTurnTuningForPlatform(undefined, "android"),
    ).toEqual(DEFAULT_GESTURE_PAGE_TURN_TUNING);
  });
});
