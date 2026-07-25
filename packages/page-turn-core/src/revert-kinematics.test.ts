import { describe, expect, it } from "vitest";

import {
  revertDuration,
  revertEasedProgress,
  revertInitialSpeed,
  revertPressedEdgeX,
} from "./revert-kinematics";

describe("curvature-driven page rebound", () => {
  it("maps roll completeness to initial speed linearly", () => {
    const slow = revertInitialSpeed(0);
    const medium = revertInitialSpeed(0.5);
    const fast = revertInitialSpeed(1);

    expect(medium).toBeCloseTo((slow + fast) * 0.5, 10);
    expect(fast).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(slow);
  });

  it("starts at the invariant speed and decelerates continuously", () => {
    const startEdgeX = 0.035;
    const completeness = 1;
    const duration = revertDuration(startEdgeX, completeness);
    const step = 1e-5;
    const initialObservedSpeed =
      (revertPressedEdgeX(startEdgeX, step, completeness) - startEdgeX) / step;
    const earlyTravel =
      revertPressedEdgeX(startEdgeX, duration * 0.25, completeness) -
      revertPressedEdgeX(startEdgeX, 0, completeness);
    const lateTravel =
      revertPressedEdgeX(startEdgeX, duration, completeness) -
      revertPressedEdgeX(startEdgeX, duration * 0.75, completeness);

    expect(initialObservedSpeed).toBeCloseTo(
      revertInitialSpeed(completeness),
      3,
    );
    expect(earlyTravel).toBeGreaterThan(lateTravel * 5);
    expect(revertPressedEdgeX(startEdgeX, duration, completeness)).toBe(1);
  });

  it("uses the same ease-out progress for hinge recovery", () => {
    expect(revertEasedProgress(0, 1)).toBe(0);
    expect(revertEasedProgress(0.25, 1)).toBeGreaterThan(0.5);
    expect(revertEasedProgress(1, 1)).toBe(1);
  });
});
