import { describe, expect, it } from "vitest";

import {
  isPageTurnSourceFacing,
  pageTurnDirectionModel,
  pageTurnFaceValues,
  pageTurnSolverDirectionForLayout,
  pageTurnTuningForLayoutDirection,
  pageTurnXScale,
  shouldDrawPageTurnShadow,
} from "./page-turn-direction";

describe("page-turn direction model", () => {
  it("derives backward semantics by mirroring forward semantics", () => {
    const forward = pageTurnDirectionModel(1);
    const backward = pageTurnDirectionModel(-1);

    expect(backward).toEqual({
      sourceSlot: forward.landingSlot,
      landingSlot: forward.sourceSlot,
      sourceFace: forward.landingFace,
      landingFace: forward.sourceFace,
    });
    expect(pageTurnXScale(1)).toBe(1);
    expect(pageTurnXScale(-1)).toBe(-1);
  });

  it("swaps source and landing textures without a second face model", () => {
    expect(pageTurnFaceValues(1, "source", "landing")).toEqual({
      front: "source",
      back: "landing",
    });
    expect(pageTurnFaceValues(-1, "source", "landing")).toEqual({
      front: "landing",
      back: "source",
    });
  });

  it("mirrors the shadow from the forward front to the backward back", () => {
    expect(shouldDrawPageTurnShadow(1, "front")).toBe(true);
    expect(shouldDrawPageTurnShadow(1, "back")).toBe(false);
    expect(shouldDrawPageTurnShadow(-1, "front")).toBe(false);
    expect(shouldDrawPageTurnShadow(-1, "back")).toBe(true);
    expect(shouldDrawPageTurnShadow(-1, "both")).toBe(true);
  });

  it("uses the same source-face semantics for lighting", () => {
    expect(isPageTurnSourceFacing(1, true)).toBe(true);
    expect(isPageTurnSourceFacing(1, false)).toBe(false);
    expect(isPageTurnSourceFacing(-1, true)).toBe(false);
    expect(isPageTurnSourceFacing(-1, false)).toBe(true);
  });

  it("mirrors one tuning for taps, rapid turns, and gestures in a spread", () => {
    const forward = { name: "forward" };
    const backward = { name: "backward" };

    expect(pageTurnTuningForLayoutDirection(forward, backward, 1, true)).toBe(
      forward,
    );
    expect(pageTurnTuningForLayoutDirection(forward, backward, -1, true)).toBe(
      forward,
    );
    expect(pageTurnSolverDirectionForLayout(1, true)).toBe(1);
    expect(pageTurnSolverDirectionForLayout(-1, true)).toBe(1);
  });

  it("preserves directional automatic tuning in a single-column layout", () => {
    const forward = { name: "forward" };
    const backward = { name: "backward" };

    expect(pageTurnTuningForLayoutDirection(forward, backward, 1, false)).toBe(
      forward,
    );
    expect(pageTurnTuningForLayoutDirection(forward, backward, -1, false)).toBe(
      backward,
    );
    expect(pageTurnSolverDirectionForLayout(-1, false)).toBe(-1);
  });
});
