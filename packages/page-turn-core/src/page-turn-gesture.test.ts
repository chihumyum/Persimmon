import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_TURN_TUNING,
  FULL_GESTURE_START_MIN_X,
  GESTURE_HINGE_CHORD_X,
  GESTURE_HINGE_BLEND_WIDTH_X,
  GESTURE_HINGE_ROTATION,
  GESTURE_LIFT_START_X,
  GESTURE_ROLL_TILT_RATE,
  MAX_PAGE_WEIGHT,
  MIN_GESTURE_COMMIT_THRESHOLD,
  MIN_PAGE_WEIGHT,
  SLOW_COMMIT_EDGE_X,
  WEAK_GRIP_MAX_COMPRESSION,
  anchoredGestureFingerX,
  clampPageTurnTuning,
  gestureTurnSpeedScale,
  gestureLiftRotationForFingerX,
  gesturePressedChordForFingerX,
  heldRollTiltForFingerX,
  pageGestureModeForStart,
  postHingeTurnProgressForFingerX,
  shouldCommitTurn,
  slowCommitBookXForStart,
  turnCommitScore,
  turnPropagationSpeed,
  weakGripPressedEdgeX,
} from "./page-turn-gesture";
import {
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  pressedRollHingeGeometry,
} from "./rolled-page-strip";

describe("page-turn gesture kinematics", () => {
  it("clamps tuning values to supported physical ranges", () => {
    expect(
      clampPageTurnTuning({
        ...DEFAULT_PAGE_TURN_TUNING,
        releaseX: 2,
        liftVelocity: -1,
        liftToLeft: 9,
        curvatureRelaxation: 0,
        pageWeight: 99,
        gestureCommitThreshold: 9,
        gestureMinimumSpeedScale: 0,
        gestureMaximumSpeedScale: 9,
        gestureVelocityGain: 9,
        gestureIdleDecaySeconds: 9,
      }),
    ).toEqual({
      releaseX: 0.8,
      liftVelocity: 0.7,
      liftToLeft: 2.6,
      curvatureRelaxation: 3.5,
      pageWeight: MAX_PAGE_WEIGHT,
      gestureCommitThreshold: 1.2,
      gestureMinimumSpeedScale: 0.5,
      gestureMaximumSpeedScale: 3,
      gestureVelocityGain: 1.2,
      gestureIdleDecaySeconds: 0.2,
    });
    expect(
      clampPageTurnTuning({
        ...DEFAULT_PAGE_TURN_TUNING,
        gestureCommitThreshold: 0,
      }).gestureCommitThreshold,
    ).toBe(MIN_GESTURE_COMMIT_THRESHOLD);
    expect(
      clampPageTurnTuning({ ...DEFAULT_PAGE_TURN_TUNING, releaseX: 2 }, 1)
        .releaseX,
    ).toBe(1);
  });

  it("maps release speed to a bounded propagation speed", () => {
    expect(
      turnPropagationSpeed({
        ...DEFAULT_PAGE_TURN_TUNING,
        releaseX: 0.52,
        liftVelocity: 1.25,
        liftToLeft: 1.8,
        pageWeight: MIN_PAGE_WEIGHT,
      }),
    ).toBeCloseTo(2.25, 8);
    expect(gestureTurnSpeedScale(0)).toBeCloseTo(0.95, 8);
    expect(gestureTurnSpeedScale(2)).toBeCloseTo(2, 8);
    expect(gestureTurnSpeedScale(20)).toBeCloseTo(2, 8);
  });

  it("combines travel, velocity, acceleration, and page weight", () => {
    expect(
      shouldCommitTurn({
        fingerX: SLOW_COMMIT_EDGE_X,
        throwVelocity: 0,
        throwAcceleration: 0,
        pageWeight: 1,
      }),
    ).toBe(true);
    expect(
      shouldCommitTurn({
        fingerX: 0.2,
        throwVelocity: 0,
        throwAcceleration: 0,
        pageWeight: 1,
      }),
    ).toBe(false);

    const gesture = {
      fingerX: SLOW_COMMIT_EDGE_X,
      throwVelocity: 0,
      throwAcceleration: 0,
    };
    const lightScore = turnCommitScore({ ...gesture, pageWeight: 0.5 });
    const defaultScore = turnCommitScore({ ...gesture, pageWeight: 1 });
    const heavyScore = turnCommitScore({ ...gesture, pageWeight: 1.5 });

    expect(lightScore).toBeCloseTo(defaultScore / 0.5, 10);
    expect(heavyScore).toBeCloseTo(defaultScore / 1.5, 10);
    expect(shouldCommitTurn({ ...gesture, pageWeight: 1.5 })).toBe(false);
  });

  it("reserves only the spine-side quarter for a weak grip", () => {
    const landingX = 0.8;
    const translatedCommitX = slowCommitBookXForStart(landingX);

    expect(pageGestureModeForStart(-0.01)).toBeNull();
    expect(pageGestureModeForStart(FULL_GESTURE_START_MIN_X - 1e-6)).toBe(
      "weak",
    );
    expect(pageGestureModeForStart(FULL_GESTURE_START_MIN_X)).toBe("full");
    expect(FULL_GESTURE_START_MIN_X).toBe(0.25);
    expect(anchoredGestureFingerX(landingX, landingX)).toBe(1);
    expect(anchoredGestureFingerX(landingX, translatedCommitX)).toBeCloseTo(
      SLOW_COMMIT_EDGE_X,
      10,
    );
  });

  it("uses every remaining pixel after the roll closes", () => {
    expect(postHingeTurnProgressForFingerX(MIN_PRESSED_EDGE_X, 0.8)).toBe(0);
    expect(postHingeTurnProgressForFingerX(-0.8, 0.8)).toBe(1);
    expect(postHingeTurnProgressForFingerX(-0.5, 1)).toBeGreaterThan(0);
    expect(postHingeTurnProgressForFingerX(-0.5, 1)).toBeLessThan(1);
    expect(postHingeTurnProgressForFingerX(0.5, 1)).toBe(0);
  });

  it("keeps the cylinder rotation linear beside and beyond the spine", () => {
    const atSpine = postHingeTurnProgressForFingerX(0, 1, 5);
    const halfwayPast = postHingeTurnProgressForFingerX(-0.05, 1, 5);
    const gentleZoneEnd = postHingeTurnProgressForFingerX(-0.1, 1, 5);

    // This entire interval is still in the turn's linear swing branch. Equal
    // finger distances must therefore produce equal cylinder-angle changes.
    expect(halfwayPast - atSpine).toBeCloseTo(gentleZoneEnd - halfwayPast, 10);
    expect(atSpine).toBeCloseTo(0.0897, 4);
    expect(gentleZoneEnd).toBeCloseTo(0.15377, 4);
    expect(gentleZoneEnd).toBeLessThan(0.16);
  });

  it("caps an inboard press at a shallow, non-committing bow", () => {
    expect(weakGripPressedEdgeX(0.2, 0.2)).toBe(1);
    expect(weakGripPressedEdgeX(0.2, 0.1)).toBeCloseTo(0.98, 8);
    expect(weakGripPressedEdgeX(0.2, -1)).toBeCloseTo(
      1 - WEAK_GRIP_MAX_COMPRESSION,
      8,
    );
  });

  it("recovers held tilt from the stable hinge path", () => {
    const hinge = pressedRollHingeGeometry();
    const halfway = MIN_PRESSED_EDGE_X - hinge.tiltDistance * 0.5;
    const halfwayTilt = heldRollTiltForFingerX(halfway);
    const projectedApexX =
      hinge.apexX * Math.cos(halfwayTilt) - hinge.apexZ * Math.sin(halfwayTilt);

    expect(heldRollTiltForFingerX(0.5)).toBe(0);
    expect(hinge.apexX - projectedApexX).toBeCloseTo(
      hinge.tiltDistance * 0.5,
      8,
    );
    expect(heldRollTiltForFingerX(SLOW_COMMIT_EDGE_X)).toBeCloseTo(
      MAX_PRESSED_ROLL_TILT,
      8,
    );
  });

  it("begins lifting at the selected horizontal trigger and commits a fast flick", () => {
    expect(MIN_PRESSED_EDGE_X).toBe(0.14);
    expect(GESTURE_LIFT_START_X).toBe(0.36);
    expect(GESTURE_ROLL_TILT_RATE).toBe(0.4);
    expect(gestureLiftRotationForFingerX(GESTURE_LIFT_START_X)).toBe(0);
    expect(
      gestureLiftRotationForFingerX(GESTURE_LIFT_START_X - 0.1),
    ).toBeGreaterThan(0);
    expect(gestureLiftRotationForFingerX(SLOW_COMMIT_EDGE_X)).toBeCloseTo(
      GESTURE_HINGE_ROTATION,
      8,
    );
    expect(
      gestureLiftRotationForFingerX(MIN_PRESSED_EDGE_X - 0.001),
    ).toBeCloseTo(GESTURE_HINGE_ROTATION, 8);
    expect(
      shouldCommitTurn({
        fingerX: 0.78,
        throwVelocity: 2.2,
        throwAcceleration: 6,
        pageWeight: 1,
      }),
    ).toBe(true);
  });

  it("maps the final approach linearly and joins the hinge without a bump", () => {
    const epsilon = 1e-6;
    const halfway = (GESTURE_LIFT_START_X + MIN_PRESSED_EDGE_X) * 0.5;

    expect(gestureLiftRotationForFingerX(MIN_PRESSED_EDGE_X)).toBe(
      GESTURE_HINGE_ROTATION,
    );
    expect(
      Math.abs(
        gestureLiftRotationForFingerX(MIN_PRESSED_EDGE_X + epsilon) -
          gestureLiftRotationForFingerX(MIN_PRESSED_EDGE_X - epsilon),
      ),
    ).toBeLessThan(1e-5);
    expect(gestureLiftRotationForFingerX(halfway)).toBeCloseTo(
      GESTURE_HINGE_ROTATION * 0.5,
      10,
    );
    expect(GESTURE_HINGE_BLEND_WIDTH_X).toBe(0.11);
    expect(
      gesturePressedChordForFingerX(MIN_PRESSED_EDGE_X, GESTURE_HINGE_ROTATION),
    ).toBeCloseTo(GESTURE_HINGE_CHORD_X, 10);
    expect(
      GESTURE_HINGE_CHORD_X * Math.cos(GESTURE_HINGE_ROTATION),
    ).toBeCloseTo(MIN_PRESSED_EDGE_X, 10);
    expect(
      gesturePressedChordForFingerX(
        halfway,
        gestureLiftRotationForFingerX(halfway),
      ) * Math.cos(gestureLiftRotationForFingerX(halfway)),
    ).toBeCloseTo(halfway, 10);
  });
});
