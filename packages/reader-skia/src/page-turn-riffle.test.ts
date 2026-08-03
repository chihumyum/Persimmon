import { describe, expect, it } from "vitest";

import {
  PAGE_RIFFLE_ARMED,
  PAGE_RIFFLE_ARMED_EDGE_FRACTION,
  PAGE_RIFFLE_INWARD,
  PAGE_RIFFLE_INTERVAL_MS,
  PAGE_RIFFLE_MINIMUM_HOLD_MS,
  PAGE_RIFFLE_PENDING,
  PAGE_RIFFLE_START_EDGE_FRACTION,
  nextPageRiffleTickAt,
  pageRiffleCandidateForTouch,
  pageRiffleGestureDisposition,
  pageRiffleHoldReady,
} from "./page-turn-riffle";
import { normalPageTurnDirectionForTouch } from "./page-turn-gesture-direction";

function resolvedSpreadGesture(
  startFraction: number,
  translationX: number,
  rapidPageTurnEnabled = true,
): string {
  const interactionWidth = 400;
  const candidate = pageRiffleCandidateForTouch(
    startFraction * interactionWidth,
    interactionWidth,
  );
  if (rapidPageTurnEnabled && candidate) {
    const disposition = pageRiffleGestureDisposition({
      ...candidate,
      translationX,
      translationY: 0,
      interactionWidth,
      minimumHorizontalTravel: 8,
    });
    if (disposition === PAGE_RIFFLE_ARMED) {
      return `rapid:${candidate.direction}`;
    }
    if (disposition === PAGE_RIFFLE_PENDING) {
      return "reserved";
    }
  }
  const normalDirection = normalPageTurnDirectionForTouch(
    startFraction * interactionWidth,
    translationX,
    true,
    interactionWidth,
  );
  return normalDirection === undefined ? "none" : `normal:${normalDirection}`;
}

describe("page riffle gesture", () => {
  it("arms right-edge rightward motion for leftward page turns", () => {
    expect(
      pageRiffleGestureDisposition({
        direction: 1,
        startEdgeDistance: 0.1,
        translationX: 8,
        translationY: 1,
        interactionWidth: 400,
        minimumHorizontalTravel: 8,
      }),
    ).toBe(PAGE_RIFFLE_ARMED);
  });

  it("arms left-edge leftward motion for rightward page turns", () => {
    expect(
      pageRiffleGestureDisposition({
        direction: -1,
        startEdgeDistance: 0.1,
        translationX: -8,
        translationY: 1,
        interactionWidth: 400,
        minimumHorizontalTravel: 8,
      }),
    ).toBe(PAGE_RIFFLE_ARMED);
  });

  it("leaves inward motion to the existing normal page-turn path", () => {
    expect(
      pageRiffleGestureDisposition({
        direction: 1,
        startEdgeDistance: 0.1,
        translationX: -8,
        translationY: 0,
        interactionWidth: 400,
        minimumHorizontalTravel: 8,
      }),
    ).toBe(PAGE_RIFFLE_INWARD);
    expect(
      pageRiffleGestureDisposition({
        direction: -1,
        startEdgeDistance: 0.1,
        translationX: 8,
        translationY: 0,
        interactionWidth: 400,
        minimumHorizontalTravel: 8,
      }),
    ).toBe(PAGE_RIFFLE_INWARD);
  });

  it("requires a 25 percent start and a current position inside 15 percent", () => {
    expect(PAGE_RIFFLE_START_EDGE_FRACTION).toBe(0.25);
    expect(PAGE_RIFFLE_ARMED_EDGE_FRACTION).toBe(0.15);
    expect(
      pageRiffleGestureDisposition({
        direction: 1,
        startEdgeDistance: 0.25,
        translationX: 40,
        translationY: 0,
        interactionWidth: 400,
        minimumHorizontalTravel: 8,
      }),
    ).toBe(PAGE_RIFFLE_ARMED);
    expect(
      pageRiffleGestureDisposition({
        direction: 1,
        startEdgeDistance: 0.25,
        translationX: 39.9,
        translationY: 0,
        interactionWidth: 400,
        minimumHorizontalTravel: 8,
      }),
    ).toBe(PAGE_RIFFLE_PENDING);
  });

  it("keeps outward vertical and sub-threshold motion pending", () => {
    const gesture = {
      direction: 1 as const,
      startEdgeDistance: 0.08,
      translationX: 8,
      translationY: 0,
      interactionWidth: 400,
      minimumHorizontalTravel: 8,
    };
    expect(pageRiffleGestureDisposition({ ...gesture, translationY: 9 })).toBe(
      PAGE_RIFFLE_PENDING,
    );
    expect(
      pageRiffleGestureDisposition({ ...gesture, translationX: 7.9 }),
    ).toBe(PAGE_RIFFLE_PENDING);
  });

  it("implements the four-zone spread interaction matrix", () => {
    expect(resolvedSpreadGesture(0.1, -40)).toBe("rapid:-1");
    expect(resolvedSpreadGesture(0.1, 40)).toBe("normal:-1");

    expect(resolvedSpreadGesture(0.375, -40)).toBe("none");
    expect(resolvedSpreadGesture(0.375, 40)).toBe("normal:-1");

    expect(resolvedSpreadGesture(0.625, -40)).toBe("normal:1");
    expect(resolvedSpreadGesture(0.625, 40)).toBe("none");

    expect(resolvedSpreadGesture(0.9, 40)).toBe("rapid:1");
    expect(resolvedSpreadGesture(0.9, -40)).toBe("normal:1");
  });

  it("gives the outward rapid override priority on the 25 percent boundaries", () => {
    expect(resolvedSpreadGesture(0.25, -40)).toBe("rapid:-1");
    expect(resolvedSpreadGesture(0.25, 40)).toBe("normal:-1");
    expect(resolvedSpreadGesture(0.75, 40)).toBe("rapid:1");
    expect(resolvedSpreadGesture(0.75, -40)).toBe("normal:1");
  });

  it("does not restore spread weak grips when rapid turns are disabled", () => {
    expect(resolvedSpreadGesture(0.1, -40, false)).toBe("none");
    expect(resolvedSpreadGesture(0.1, 40, false)).toBe("normal:-1");
    expect(resolvedSpreadGesture(0.375, -40, false)).toBe("none");
    expect(resolvedSpreadGesture(0.625, 40, false)).toBe("none");
    expect(resolvedSpreadGesture(0.9, -40, false)).toBe("normal:1");
    expect(resolvedSpreadGesture(0.9, 40, false)).toBe("none");
  });

  it("normalizes both outside zones against the complete interaction width", () => {
    expect(pageRiffleCandidateForTouch(40, 400)).toEqual({
      direction: -1,
      startEdgeDistance: 0.1,
    });
    expect(pageRiffleCandidateForTouch(360, 400)).toEqual({
      direction: 1,
      startEdgeDistance: 0.1,
    });
    expect(pageRiffleCandidateForTouch(40, 800)).toEqual({
      direction: -1,
      startEdgeDistance: 0.05,
    });
    expect(pageRiffleCandidateForTouch(760, 800)).toEqual({
      direction: 1,
      startEdgeDistance: 0.05,
    });
    expect(pageRiffleCandidateForTouch(400, 800)).toBeUndefined();
  });

  it("schedules from the current frame instead of catching up missed ticks", () => {
    expect(nextPageRiffleTickAt(450)).toBe(450 + PAGE_RIFFLE_INTERVAL_MS);
  });

  it("requires at least 250 ms inside the armed edge before the first turn", () => {
    expect(PAGE_RIFFLE_MINIMUM_HOLD_MS).toBe(250);
    expect(pageRiffleHoldReady(1_000, 1_249)).toBe(false);
    expect(pageRiffleHoldReady(1_000, 1_250)).toBe(true);
  });

  it("uses the shared roughly ten-page-per-second launch cadence", () => {
    expect(PAGE_RIFFLE_INTERVAL_MS).toBe(100);
    expect(1_000 / PAGE_RIFFLE_INTERVAL_MS).toBeCloseTo(10, 1);
  });
});
