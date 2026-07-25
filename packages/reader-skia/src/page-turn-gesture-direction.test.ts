import { describe, expect, it } from "vitest";

import {
  bookXForGestureTravel,
  pageTurnDirectionFromTranslation,
} from "./page-turn-gesture-direction";

describe("page turn gesture direction", () => {
  it("maps a right-to-left swipe to the next page", () => {
    expect(pageTurnDirectionFromTranslation(-1)).toBe(1);
    expect(pageTurnDirectionFromTranslation(-120)).toBe(1);
  });

  it("maps a left-to-right swipe to the previous page", () => {
    expect(pageTurnDirectionFromTranslation(1)).toBe(-1);
    expect(pageTurnDirectionFromTranslation(120)).toBe(-1);
  });

  it("waits for non-zero travel instead of defaulting to the previous page", () => {
    expect(pageTurnDirectionFromTranslation(0)).toBeUndefined();
    expect(pageTurnDirectionFromTranslation(Number.NaN)).toBeUndefined();
  });

  it("maps finger pixels to paper pixels one-to-one", () => {
    expect(bookXForGestureTravel(0.9, -120, 1, 400)).toBeCloseTo(0.6, 8);
    expect(bookXForGestureTravel(0.9, 120, -1, 400)).toBeCloseTo(0.6, 8);
    expect((0.9 - bookXForGestureTravel(0.9, -120, 1, 400)) * 400).toBeCloseTo(
      120,
      8,
    );
  });

  it("preserves the complete two-page swipe range in spread layout", () => {
    const physicalPageWidth = 400;
    expect(
      bookXForGestureTravel(0.9, -physicalPageWidth, 1, physicalPageWidth),
    ).toBeCloseTo(-0.1, 8);
    expect(
      bookXForGestureTravel(0.9, -physicalPageWidth * 2, 1, physicalPageWidth),
    ).toBe(-1);
  });
});
