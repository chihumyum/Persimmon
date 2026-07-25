import { describe, expect, it } from "vitest";

import {
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  RolledPageStrip,
  TURN_UNROLL_START,
  TURN_VALIDATION_FRAME_COUNT,
  pressedRollCompleteness,
  pressedRollHingeGeometry,
  turnBendRetention,
} from "./rolled-page-strip";

describe("continuous-curvature page strip", () => {
  it("forms a broad Euler-elastica bow without a corner kink", () => {
    const strip = new RolledPageStrip();
    strip.setPressedEdge(0.52);
    const points = strip.getPoints();
    const turningAngles: number[] = [];

    for (let index = 1; index < points.length - 1; index += 1) {
      const before = Math.atan2(
        points[index]!.z - points[index - 1]!.z,
        points[index]!.x - points[index - 1]!.x,
      );
      const after = Math.atan2(
        points[index + 1]!.z - points[index]!.z,
        points[index + 1]!.x - points[index]!.x,
      );
      turningAngles.push(after - before);
    }

    const magnitudes = turningAngles.map(Math.abs);
    const center = magnitudes[Math.floor(magnitudes.length / 2)]!;
    const totalTurning = magnitudes.reduce((sum, angle) => sum + angle, 0);

    expect(strip.getMetrics().edgeX).toBeCloseTo(0.52, 4);
    expect(strip.getMetrics().edgeZ).toBeCloseTo(0, 4);
    expect(strip.getMetrics().maxLift).toBeGreaterThan(0.35);
    expect(magnitudes[0]).toBeLessThan(center * 0.08);
    expect(magnitudes.at(-1)!).toBeLessThan(center * 0.08);
    expect(Math.max(...magnitudes) / totalTurning).toBeLessThan(0.04);
    expect(turningAngles.every((angle) => angle < 0)).toBe(true);
  });

  it("starts a released turn from the exact held shape", () => {
    const held = new RolledPageStrip();
    const released = new RolledPageStrip();
    held.setPressedState(MIN_PRESSED_EDGE_X, MAX_PRESSED_ROLL_TILT);
    released.setTurnProgress(0, MIN_PRESSED_EDGE_X, 0, MAX_PRESSED_ROLL_TILT);

    expect(released.getPoints()).toEqual(held.getPoints());
  });

  it("measures roll completeness monotonically", () => {
    expect(pressedRollCompleteness(1)).toBe(0);
    expect(pressedRollCompleteness(MIN_PRESSED_EDGE_X)).toBeCloseTo(1, 8);
    expect(pressedRollCompleteness(-0.25)).toBeCloseTo(1, 8);
    expect(pressedRollCompleteness(0.7)).toBeLessThan(
      pressedRollCompleteness(0.52),
    );
    expect(pressedRollCompleteness(0.52)).toBeLessThan(
      pressedRollCompleteness(0.3),
    );
  });

  it("derives the complete-roll hinge from a stable material point", () => {
    const hinge = pressedRollHingeGeometry();
    const tiltedApexX =
      hinge.apexX * Math.cos(hinge.maxTilt) -
      hinge.apexZ * Math.sin(hinge.maxTilt);

    expect(hinge.apexX).toBeCloseTo(0.0175, 5);
    expect(hinge.apexZ).toBeCloseTo(0.3807, 4);
    expect(hinge.tiltDistance).toBeCloseTo(hinge.apexX - tiltedApexX, 10);
    expect(hinge.tiltDistance).toBeGreaterThan(0.27);
    expect(hinge.tiltDistance).toBeLessThan(0.28);
  });

  it(`stays continuous and above the book through ${TURN_VALIDATION_FRAME_COUNT} frames`, () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0, 0.52);
    let previous = strip.getPoints().map((point) => ({ ...point }));
    let previousEdgeX = strip.getMetrics().edgeX;

    for (let frame = 1; frame < TURN_VALIDATION_FRAME_COUNT; frame += 1) {
      strip.setTurnProgress(
        frame / (TURN_VALIDATION_FRAME_COUNT - 1),
        0.52,
        1 / 60,
      );
      const points = strip.getPoints();
      const metrics = strip.getMetrics();
      const maximumFrameTravel = Math.max(
        ...points.map((point, index) =>
          Math.hypot(
            point.x - previous[index]!.x,
            point.z - previous[index]!.z,
          ),
        ),
      );

      expect(Math.min(...points.map((point) => point.z))).toBeGreaterThan(
        -0.001,
      );
      expect(metrics.arcLength).toBe(1);
      expect(metrics.edgeX).toBeLessThanOrEqual(previousEdgeX + 0.003);
      expect(maximumFrameTravel).toBeLessThan(0.18);
      previous = points.map((point) => ({ ...point }));
      previousEdgeX = metrics.edgeX;
    }

    expect(strip.getMetrics().edgeX).toBeCloseTo(-1, 5);
    expect(strip.getMetrics().edgeZ).toBeCloseTo(0, 5);
    expect(strip.getMetrics().maxLift).toBeCloseTo(0, 5);
  });

  it("has no shape jump at either unroll boundary", () => {
    for (const boundary of [TURN_UNROLL_START, 1]) {
      const before = new RolledPageStrip();
      const after = new RolledPageStrip();
      before.setTurnProgress(boundary - 1e-6, 0.52);
      after.setTurnProgress(boundary + 1e-6, 0.52);
      const maximumDifference = Math.max(
        ...before
          .getPoints()
          .map((point, index) =>
            Math.hypot(
              point.x - after.getPoints()[index]!.x,
              point.z - after.getPoints()[index]!.z,
            ),
          ),
      );
      expect(maximumDifference).toBeLessThan(0.0001);
    }
  });

  it("retains curl through the latter half and eases flat without a snap", () => {
    const start = turnBendRetention(TURN_UNROLL_START, 7);
    const middle = turnBendRetention(0.5, 7);
    const later = turnBendRetention(0.75, 7);
    const nearlyFlat = turnBendRetention(0.99, 7);
    const flat = turnBendRetention(1, 7);

    expect(start).toBe(1);
    expect(middle).toBeGreaterThan(0.55);
    expect(later).toBeGreaterThan(0.05);
    expect(later).toBeLessThan(middle);
    expect(nearlyFlat).toBeGreaterThan(0);
    expect(nearlyFlat).toBeLessThan(0.0001);
    expect(flat).toBe(0);
    expect(nearlyFlat - flat).toBeLessThan(
      turnBendRetention(0.98, 7) - nearlyFlat,
    );
  });

  it("is deterministic and stops without residual motion", () => {
    const first = new RolledPageStrip();
    const second = new RolledPageStrip();
    first.setTurnProgress(0.63, 0.52, 1 / 60);
    second.setTurnProgress(0.63, 0.52, 1 / 60);

    expect(first.getPoints()).toEqual(second.getPoints());
    first.stop();
    expect(first.getMetrics().meanSpeed).toBe(0);
  });

  it("flattens the curl earlier when flatten speed is increased", () => {
    const slow = new RolledPageStrip();
    const fast = new RolledPageStrip();

    slow.setTurnProgress(0.72, 0.52, 0, 0, 3.5);
    fast.setTurnProgress(0.72, 0.52, 0, 0, 14);

    expect(totalCurvature(fast)).toBeLessThan(totalCurvature(slow));

    slow.setTurnProgress(1, 0.52, 0, 0, 3.5);
    fast.setTurnProgress(1, 0.52, 0, 0, 14);
    expect(slow.getMetrics().maxLift).toBeCloseTo(0, 10);
    expect(fast.getMetrics().maxLift).toBeCloseTo(0, 10);
  });
});

function totalCurvature(strip: RolledPageStrip): number {
  const points = strip.getPoints();
  let total = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const before = Math.atan2(
      points[index]!.z - points[index - 1]!.z,
      points[index]!.x - points[index - 1]!.x,
    );
    const after = Math.atan2(
      points[index + 1]!.z - points[index]!.z,
      points[index + 1]!.x - points[index]!.x,
    );
    total += Math.abs(after - before);
  }
  return total;
}
