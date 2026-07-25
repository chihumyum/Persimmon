import { describe, expect, it } from "vitest";

import {
  isPageTurnSourceFacing,
  pageTurnDirectionModel,
  pageTurnFaceValues,
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
});
