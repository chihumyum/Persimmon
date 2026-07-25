import {
  NaturalPageTurnController,
  RolledPageStrip,
} from "@persimmon/page-turn-core";
import { describe, expect, it } from "vitest";

import {
  buildPageTurnLookup,
  PAGE_TURN_SEGMENT_COUNT,
} from "./page-turn-mesh-data";
import {
  PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  inversePageTurnProjectedY,
  limitPageTurnMaterialSlope,
  pageTurnCameraBookX,
  pageTurnCameraBookXForLayout,
  pageTurnPerspectiveCorrectProgress,
  pageTurnPerspectiveScale,
  projectPageTurnBookX,
} from "./page-turn-perspective";
import { packPageTurnProfile } from "./page-turn-shader";

const SPREAD_CAMERA = pageTurnCameraBookXForLayout(true);

/** Visible depth as the paper shader reads it back out of a lookup cell. */
function cellDepth(lookup: readonly number[], cell: number): number {
  return Math.max(0, Math.abs(lookup[cell * 4 + 3]!) - 1);
}

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
    // The band the viewport shows is 1 / scale of the sheet, so the paper's own
    // top and bottom edges move off screen as the curl rises.
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

  it("keeps a lookup cell from sweeping more than one profile segment", () => {
    const halfCell = 0.5 / 512;
    const limit = 1 / (PAGE_TURN_SEGMENT_COUNT * halfCell);

    expect(
      limitPageTurnMaterialSlope(2.2, PAGE_TURN_SEGMENT_COUNT, halfCell),
    ).toBe(2.2);
    expect(
      limitPageTurnMaterialSlope(limit * 40, PAGE_TURN_SEGMENT_COUNT, halfCell),
    ).toBeCloseTo(limit, 6);
    expect(
      limitPageTurnMaterialSlope(
        limit * -40,
        PAGE_TURN_SEGMENT_COUNT,
        halfCell,
      ),
    ).toBeCloseTo(-limit, 6);
    expect(limit * halfCell).toBeCloseTo(1 / PAGE_TURN_SEGMENT_COUNT, 6);
  });
});

describe("page-turn perspective across a real turn", () => {
  it("does not pull raised paper right for one frame during a leftward drag", () => {
    const controller = new NaturalPageTurnController();
    const startBookX = 0.9;
    controller.beginDrag(startBookX, 0.5, 0);
    let previous = controller
      .getPoints()
      .map((point) => projectPageTurnBookX(point.x, point.z, SPREAD_CAMERA));

    for (let frame = 1; frame <= 220; frame += 1) {
      controller.moveDrag(startBookX - frame * 0.0025, 0.5, frame / 240);
      const projected = controller
        .getPoints()
        .map((point) => projectPageTurnBookX(point.x, point.z, SPREAD_CAMERA));

      for (let material = 0; material < projected.length; material += 1) {
        expect(projected[material]).toBeLessThanOrEqual(
          previous[material]! + 0.000001,
        );
      }
      previous = projected;
    }
  });

  it("magnifies the raised curl more than the flat paper at the spine", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0.3, 0.96, 1 / 60);
    const lookup = buildPageTurnLookup(
      packPageTurnProfile(strip.getPoints()),
      512,
      -1,
      1,
    );

    let spineDepth = Number.POSITIVE_INFINITY;
    let apexDepth = 0;
    for (let cell = 0; cell < 512; cell += 1) {
      if (Math.abs(lookup[cell * 4 + 3]!) < 0.5) {
        continue;
      }
      const depth = cellDepth(lookup, cell);
      spineDepth = Math.min(spineDepth, depth);
      apexDepth = Math.max(apexDepth, depth);
    }

    // Flat paper at the spine keeps its size; the curl is read from a much
    // narrower band of the capture, which is what enlarges its glyphs.
    expect(pageTurnPerspectiveScale(spineDepth)).toBeCloseTo(1, 2);
    expect(pageTurnPerspectiveScale(apexDepth)).toBeGreaterThan(1.2);
  });

  it("bounds the in-cell texture correction everywhere along a turn", () => {
    const strip = new RolledPageStrip();
    const halfCellBookX = (0.5 * 2) / 512;
    let worstCorrection = 0;
    for (let step = 0; step <= 40; step += 1) {
      strip.setTurnProgress(step / 40, 0.96, 1 / 60);
      const lookup = buildPageTurnLookup(
        packPageTurnProfile(strip.getPoints()),
        512,
        -1,
        1,
      );
      for (let cell = 0; cell < 512; cell += 1) {
        if (Math.abs(lookup[cell * 4 + 3]!) < 0.5) {
          continue;
        }
        worstCorrection = Math.max(
          worstCorrection,
          Math.abs(lookup[cell * 4 + 1]! * halfCellBookX),
        );
      }
    }

    expect(worstCorrection).toBeGreaterThan(0);
    expect(worstCorrection).toBeLessThanOrEqual(1 / PAGE_TURN_SEGMENT_COUNT);
  });

  it("starts and ends a turn with an identity mapping", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(1, 0.96, 1 / 60);
    const profile = packPageTurnProfile(strip.getPoints());

    for (let index = 0; index <= PAGE_TURN_SEGMENT_COUNT; index += 1) {
      const offset = index * 4;
      const depth = profile[offset + 1]!;
      expect(depth).toBeCloseTo(0, 6);
      expect(
        projectPageTurnBookX(profile[offset]!, depth, SPREAD_CAMERA),
      ).toBeCloseTo(profile[offset]!, 6);
    }
    expect(inversePageTurnProjectedY(0.23, 0)).toBeCloseTo(0.23, 6);
  });
});
