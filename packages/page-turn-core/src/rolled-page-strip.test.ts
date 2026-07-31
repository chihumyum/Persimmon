import { describe, expect, it } from "vitest";

import {
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  RolledPageStrip,
  TURN_VALIDATION_FRAME_COUNT,
  pressedRollCompleteness,
  pressedRollHingeGeometry,
  turnCurlRetention,
  turnCurvatureUniformity,
  turnLandingStart,
  type RolledPagePoint,
} from "./rolled-page-strip";

/**
 * Peak over mean curvature of the pinned elastica bow. The continuum value is
 * pi / 2; a 65-point profile samples slightly under the true peak.
 */
const PINNED_CURVATURE_SPREAD = 1.5466;

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

    expect(hinge.apexX).toBeCloseTo(MIN_PRESSED_EDGE_X * 0.5, 10);
    expect(hinge.apexZ).toBeCloseTo(0.3922, 4);
    expect(hinge.tiltDistance).toBeCloseTo(hinge.apexX - tiltedApexX, 10);
    expect(hinge.tiltDistance).toBeGreaterThan(0.35);
    expect(hinge.tiltDistance).toBeLessThan(0.36);
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

  it("never pulls the sheet back toward the page it came from", () => {
    // The reader sees the sheet's leading edge sweep across the landing page.
    // The free edge is tucked inside the roll and is free to swing as the roll
    // opens, but nothing the eye tracks may retreat while the turn advances.
    for (const startRotation of [0, MAX_PRESSED_ROLL_TILT]) {
      for (const curvatureRelaxation of [3.5, 7, 14]) {
        const strip = new RolledPageStrip();
        strip.setTurnProgress(
          0,
          MIN_PRESSED_EDGE_X,
          0,
          startRotation,
          curvatureRelaxation,
        );
        let previousLeadingX = leadingX(strip.getPoints());

        for (let step = 1; step <= 240; step += 1) {
          strip.setTurnProgress(
            step / 240,
            MIN_PRESSED_EDGE_X,
            1 / 240,
            startRotation,
            curvatureRelaxation,
          );
          const currentLeadingX = leadingX(strip.getPoints());
          expect(currentLeadingX).toBeLessThanOrEqual(previousLeadingX + 1e-9);
          previousLeadingX = currentLeadingX;
        }
        expect(previousLeadingX).toBeCloseTo(-1, 5);
      }
    }
  });

  it("lays the paper down instead of dropping it flat all at once", () => {
    const strip = new RolledPageStrip();
    let previousLanded = -1;

    for (let step = 0; step <= 60; step += 1) {
      strip.setTurnProgress(
        step / 60,
        MIN_PRESSED_EDGE_X,
        0,
        MAX_PRESSED_ROLL_TILT,
      );
      const points = strip.getPoints();
      const landed = landedFraction(points);

      // contact only ever grows, and the sheet never sinks into the page it is
      // landing on
      expect(landed).toBeGreaterThanOrEqual(previousLanded);
      expect(
        Math.min(...points.map((point) => point.z)),
      ).toBeGreaterThanOrEqual(0);
      previousLanded = landed;
    }

    strip.setTurnProgress(0.5, MIN_PRESSED_EDGE_X, 0, MAX_PRESSED_ROLL_TILT);
    // halfway through, a real spread of the sheet is already resting on the
    // landing page rather than hovering over it
    expect(landedFraction(strip.getPoints())).toBeGreaterThan(0.4);
  });

  it("has no shape jump where the swing hands over to the landing", () => {
    const strip = new RolledPageStrip();
    strip.setPressedEdge(0.52);
    const landingStart = turnLandingStart(
      Math.atan2(
        strip.getPoints()[1]!.z - strip.getPoints()[0]!.z,
        strip.getPoints()[1]!.x - strip.getPoints()[0]!.x,
      ),
    );

    for (const boundary of [landingStart, 1]) {
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

  it("gives up curl faster than it gives up paper, so the roll opens", () => {
    // radius = remaining paper / turn still held. It has to grow the whole way
    // out, otherwise the roll winds tighter as it lays paper down.
    for (const relaxation of [3.5, 7, 14]) {
      let previousRadius = 0;
      for (let step = 0; step < 100; step += 1) {
        const landed = step / 100;
        const retention = turnCurlRetention(landed, relaxation);
        const radius = (1 - landed) / retention;
        expect(radius).toBeGreaterThan(previousRadius);
        previousRadius = radius;
      }
    }

    expect(turnCurlRetention(0, 7)).toBe(1);
    expect(turnCurlRetention(1, 7)).toBe(0);
    // a higher relaxation setting lets the roll go sooner
    expect(turnCurlRetention(0.5, 14)).toBeLessThan(
      turnCurlRetention(0.5, 3.5),
    );
  });

  it("unrolls as a cylinder whose radius keeps growing", () => {
    const strip = new RolledPageStrip();
    const setProgress = (progress: number) =>
      strip.setTurnProgress(
        progress,
        MIN_PRESSED_EDGE_X,
        0,
        MAX_PRESSED_ROLL_TILT,
        7,
      );

    setProgress(0);
    let previousTurning = totalTurning(roll(strip.getPoints()));
    let previousSpread = curvatureSpread(roll(strip.getPoints()));
    let roundWhileCurled = false;

    // The roll leaves the finger as the pinned bow: bend piled into the middle.
    expect(previousSpread).toBeCloseTo(PINNED_CURVATURE_SPREAD, 3);

    // Stops while the roll still has enough paper left to measure a curvature
    // distribution across.
    for (let step = 1; step <= 34; step += 1) {
      const progress = step / 40;
      setProgress(progress);
      const points = roll(strip.getPoints());
      const turning = totalTurning(points);
      const spread = curvatureSpread(points);

      // Total turning is the roll's arc length over its radius, so a shrinking
      // turn on a shrinking roll is a widening cylinder.
      expect(turning).toBeLessThan(previousTurning);
      if (points.length >= 30) {
        expect(spread).toBeLessThanOrEqual(previousSpread + 1e-9);
        previousSpread = spread;
      } else {
        // Fewer samples than that and the ratio is dominated by where the
        // contact happens to fall between them; by then it is a cylinder.
        expect(spread).toBeLessThan(1.05);
      }
      if (turning > 2) {
        roundWhileCurled ||= spread < 1.1;
      }
      previousTurning = turning;
    }

    // Roundness has to arrive while the sheet is still visibly curled, not
    // only once it is nearly flat.
    expect(roundWhileCurled).toBe(true);
    expect(previousSpread).toBeLessThan(1.02);
  });

  it("keeps the pinched sheet on the pinned bow at every finger position", () => {
    const strip = new RolledPageStrip();

    for (const edgeX of [0.85, 0.52, 0.25, MIN_PRESSED_EDGE_X]) {
      strip.setPressedEdge(edgeX);
      expect(curvatureSpread(strip.getPoints())).toBeCloseTo(
        PINNED_CURVATURE_SPREAD,
        3,
      );
    }
  });

  it("hands the held crease to the unroll before spreading it", () => {
    expect(turnCurvatureUniformity(1)).toBe(0);
    expect(turnCurvatureUniformity(0)).toBe(1);
    expect(turnCurvatureUniformity(0.75)).toBeLessThan(
      turnCurvatureUniformity(0.5),
    );
    expect(turnCurvatureUniformity(-1)).toBe(1);
    expect(turnCurvatureUniformity(2)).toBe(0);
  });

  it("keeps the paper inextensible through the whole unroll", () => {
    const strip = new RolledPageStrip();

    for (const startRotation of [
      0,
      MAX_PRESSED_ROLL_TILT * 0.5,
      MAX_PRESSED_ROLL_TILT,
    ]) {
      for (let step = 0; step <= 12; step += 1) {
        strip.setTurnProgress(step / 12, MIN_PRESSED_EDGE_X, 0, startRotation);
        const points = strip.getPoints();
        const segmentLength = 1 / (points.length - 1);

        for (let index = 1; index < points.length; index += 1) {
          expect(
            Math.hypot(
              points[index]!.x - points[index - 1]!.x,
              points[index]!.z - points[index - 1]!.z,
            ),
          ).toBeCloseTo(segmentLength, 4);
        }
      }
    }
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

/** Leftmost point of the sheet: the boundary the reader watches advance. */
function leadingX(points: readonly RolledPagePoint[]): number {
  return Math.min(...points.map((point) => point.x));
}

/**
 * The part of the sheet still in the roll. Paper already resting on the
 * landing page is flat by construction and carries no curvature to measure.
 */
function roll(points: readonly RolledPagePoint[]): readonly RolledPagePoint[] {
  let contactEnd = 0;
  while (
    contactEnd + 1 < points.length &&
    Math.abs(points[contactEnd + 1]!.z) < 1e-9
  ) {
    contactEnd += 1;
  }
  return points.slice(contactEnd);
}

/** Share of the sheet resting on the landing page. */
function landedFraction(points: readonly RolledPagePoint[]): number {
  return (
    points.filter((point) => Math.abs(point.z) < 0.004).length / points.length
  );
}

/** Signed-free turning angle per interior sample, safe past a half turn. */
function segmentTurning(points: readonly RolledPagePoint[]): number[] {
  const turning: number[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const beforeX = points[index]!.x - points[index - 1]!.x;
    const beforeZ = points[index]!.z - points[index - 1]!.z;
    const afterX = points[index + 1]!.x - points[index]!.x;
    const afterZ = points[index + 1]!.z - points[index]!.z;
    turning.push(
      Math.abs(
        Math.atan2(
          beforeX * afterZ - beforeZ * afterX,
          beforeX * afterX + beforeZ * afterZ,
        ),
      ),
    );
  }
  return turning;
}

function totalTurning(points: readonly RolledPagePoint[]): number {
  return segmentTurning(points).reduce((sum, angle) => sum + angle, 0);
}

/**
 * Peak curvature over mean curvature: 1 is a circular arc, pi / 2 is the
 * pinned elastica bow whose bend is concentrated mid-sheet.
 */
function curvatureSpread(points: readonly RolledPagePoint[]): number {
  const turning = segmentTurning(points);
  const mean = turning.reduce((sum, angle) => sum + angle, 0) / turning.length;
  return Math.max(...turning) / mean;
}

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
