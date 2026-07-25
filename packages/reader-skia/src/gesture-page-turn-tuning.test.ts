import { describe, expect, it } from "vitest";

import {
  DEFAULT_GESTURE_PAGE_TURN_TUNING,
  normalizeGesturePageTurnTuning,
} from "./gesture-page-turn-tuning";

describe("gesture page turn tuning", () => {
  it("uses raw solver constants as stable defaults", () => {
    expect(normalizeGesturePageTurnTuning(undefined)).toEqual(
      DEFAULT_GESTURE_PAGE_TURN_TUNING,
    );
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
});
