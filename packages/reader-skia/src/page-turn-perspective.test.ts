import { describe, expect, it } from "vitest";

import {
  PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  inversePageTurnProjectedY,
  pageTurnCameraBookX,
  pageTurnCameraBookXForLayout,
  pageTurnPerspectiveCorrectProgress,
  pageTurnPerspectiveScale,
  projectPageTurnBookX,
} from "./page-turn-perspective";

describe("centered page-turn perspective", () => {
  it("keeps flat paper unchanged and enlarges raised paper", () => {
    expect(pageTurnPerspectiveScale(0)).toBe(1);
    expect(pageTurnPerspectiveScale(0.5)).toBeGreaterThan(1.1);
    expect(pageTurnPerspectiveScale(1)).toBeCloseTo(4 / 3, 6);
    expect(pageTurnPerspectiveScale(100)).toBe(PAGE_TURN_MAX_PERSPECTIVE_SCALE);
  });

  it("grows monotonically with lift so a turn cannot step", () => {
    let previous = pageTurnPerspectiveScale(0);
    for (let depth = 0.02; depth <= 1; depth += 0.02) {
      const scale = pageTurnPerspectiveScale(depth);
      expect(scale).toBeGreaterThan(previous);
      previous = scale;
    }
  });

  it("focuses a spread on the spine and a single page on its center", () => {
    expect(pageTurnCameraBookX(-1, 1)).toBe(0);
    expect(pageTurnCameraBookX(0, 1)).toBe(0.5);
    expect(pageTurnCameraBookXForLayout(true)).toBe(0);
    expect(pageTurnCameraBookXForLayout(false)).toBe(0.5);
    expect(projectPageTurnBookX(0, 1, 0)).toBe(0);
    expect(projectPageTurnBookX(0.75, 1, 0.5)).toBeGreaterThan(0.75);
  });

  it("holds the viewport center while the sheet overflows both edges", () => {
    expect(inversePageTurnProjectedY(0.5, 1)).toBe(0.5);
    expect(inversePageTurnProjectedY(0, 1)).toBeGreaterThan(0);
    expect(inversePageTurnProjectedY(1, 1)).toBeLessThan(1);
  });

  it("samples a narrower paper band the higher the paper lifts", () => {
    const flatBand =
      inversePageTurnProjectedY(1, 0) - inversePageTurnProjectedY(0, 0);
    const raisedBand =
      inversePageTurnProjectedY(1, 0.4) - inversePageTurnProjectedY(0, 0.4);
    const apexBand =
      inversePageTurnProjectedY(1, 0.95) - inversePageTurnProjectedY(0, 0.95);

    expect(flatBand).toBeCloseTo(1, 6);
    expect(raisedBand).toBeCloseTo(1 / pageTurnPerspectiveScale(0.4), 6);
    expect(apexBand).toBeLessThan(raisedBand);
    expect(apexBand).toBeLessThan(0.8);
  });

  it("uses perspective-correct material progress", () => {
    expect(pageTurnPerspectiveCorrectProgress(0, 0, 1)).toBe(0);
    expect(pageTurnPerspectiveCorrectProgress(1, 0, 1)).toBe(1);
    expect(pageTurnPerspectiveCorrectProgress(0.5, 0, 1)).toBeGreaterThan(0.5);
  });
});
