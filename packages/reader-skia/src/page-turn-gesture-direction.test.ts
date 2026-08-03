import { describe, expect, it } from "vitest";

import {
  bookXForGestureTravel,
  normalPageTurnDirectionForTouch,
  pageTurnGestureReleaseSample,
  pageTurnDirectionFromTranslation,
  pageTurnStartBookXForTouch,
  pageTurnTerminalDirection,
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

  it("recovers a coalesced terminal swipe without turning vertical or tiny input", () => {
    expect(pageTurnTerminalDirection(-280, 8, 1)).toBe(1);
    expect(pageTurnTerminalDirection(280, -8, 1)).toBe(-1);
    expect(pageTurnTerminalDirection(0.5, 0, 1)).toBeUndefined();
    expect(pageTurnTerminalDirection(20, 21, 1)).toBeUndefined();
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

  it("accepts ordinary spread turns only on their physical page", () => {
    const interactionWidth = 800;

    expect(normalPageTurnDirectionForTouch(0, 40, true, interactionWidth)).toBe(
      -1,
    );
    expect(
      normalPageTurnDirectionForTouch(399, 40, true, interactionWidth),
    ).toBe(-1);
    expect(
      normalPageTurnDirectionForTouch(200, -40, true, interactionWidth),
    ).toBeUndefined();
    expect(
      normalPageTurnDirectionForTouch(400, 40, true, interactionWidth),
    ).toBeUndefined();
    expect(
      normalPageTurnDirectionForTouch(400, -40, true, interactionWidth),
    ).toBe(1);
    expect(
      normalPageTurnDirectionForTouch(600, 40, true, interactionWidth),
    ).toBeUndefined();
    expect(
      normalPageTurnDirectionForTouch(800, -40, true, interactionWidth),
    ).toBe(1);
  });

  it("keeps both ordinary directions available in single-page layout", () => {
    expect(normalPageTurnDirectionForTouch(300, -40, false, 400)).toBe(1);
    expect(normalPageTurnDirectionForTouch(100, 40, false, 400)).toBe(-1);
  });

  it("rejects invalid spread origins without manufacturing a direction", () => {
    expect(normalPageTurnDirectionForTouch(-1, 40, true, 800)).toBeUndefined();
    expect(
      normalPageTurnDirectionForTouch(801, -40, true, 800),
    ).toBeUndefined();
    expect(normalPageTurnDirectionForTouch(200, 40, true, 0)).toBeUndefined();
    expect(
      normalPageTurnDirectionForTouch(Number.NaN, 40, true, 800),
    ).toBeUndefined();
  });

  it("maps every valid ordinary spread turn to a full grip", () => {
    const physicalPageWidth = 400;
    const interactionWidth = 800;

    expect(
      pageTurnStartBookXForTouch(
        0,
        -1,
        true,
        physicalPageWidth,
        interactionWidth,
      ),
    ).toBe(1);
    expect(
      pageTurnStartBookXForTouch(
        399,
        -1,
        true,
        physicalPageWidth,
        interactionWidth,
      ),
    ).toBeGreaterThan(0.5);
    expect(
      pageTurnStartBookXForTouch(
        400,
        1,
        true,
        physicalPageWidth,
        interactionWidth,
      ),
    ).toBe(0.5);
    expect(
      pageTurnStartBookXForTouch(
        800,
        1,
        true,
        physicalPageWidth,
        interactionWidth,
      ),
    ).toBe(1);
  });

  it("preserves the original single-page touch mapping", () => {
    const physicalPageWidth = 400;

    expect(
      pageTurnStartBookXForTouch(
        200,
        1,
        false,
        physicalPageWidth,
        physicalPageWidth,
      ),
    ).toBe(0.5);
    expect(
      pageTurnStartBookXForTouch(
        200,
        -1,
        false,
        physicalPageWidth,
        physicalPageWidth,
      ),
    ).toBe(0.5);
  });

  it("samples symmetric terminal fling geometry in both directions", () => {
    const forward = pageTurnGestureReleaseSample(0.8, -280, -1_400, 1, 400);
    const backward = pageTurnGestureReleaseSample(0.8, 280, 1_400, -1, 400);

    expect(backward).toEqual(forward);
    expect(forward.currentBookX).toBeCloseTo(0.1, 8);
    expect(forward.turnProgress).toBeCloseTo(280 / (400 * 0.72), 8);
    expect(forward.throwVelocity).toBeCloseTo(3.5, 8);
  });
});
