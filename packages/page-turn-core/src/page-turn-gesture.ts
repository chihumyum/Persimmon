import {
  DEFAULT_CURVATURE_RELAXATION,
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  pressedRollHingeGeometry,
} from "./rolled-page-strip";

export interface PageTurnTuning {
  releaseX: number;
  liftVelocity: number;
  liftToLeft: number;
  curvatureRelaxation: number;
  pageWeight: number;
  gestureCommitThreshold: number;
  gestureMinimumSpeedScale: number;
  gestureMaximumSpeedScale: number;
  gestureVelocityGain: number;
  gestureIdleDecaySeconds: number;
}

export interface TurnCommitInput {
  fingerX: number;
  throwVelocity: number;
  throwAcceleration: number;
  pageWeight: number;
}

export interface ReleasedPageTurnGesture {
  readonly pressedEdgeX: number;
  readonly heldRollTilt: number;
  readonly speedScale: number;
  readonly turnProgress: number;
  readonly settlingProgress: number;
  readonly releasedAtSeconds?: number;
}

export type PageGestureMode = "full" | "weak";

export const DEFAULT_PAGE_TURN_TUNING: PageTurnTuning = {
  releaseX: 0.72,
  liftVelocity: 1.35,
  liftToLeft: 2,
  curvatureRelaxation: 7,
  pageWeight: 1,
  gestureCommitThreshold: 0.78,
  gestureMinimumSpeedScale: 0.95,
  gestureMaximumSpeedScale: 2,
  gestureVelocityGain: 0.6,
  gestureIdleDecaySeconds: 0.09,
};

/** Only the quarter of a page nearest the spine uses the weak-grip response. */
export const FULL_GESTURE_START_MIN_X = 0.25;
export const WEAK_GRIP_MAX_COMPRESSION = 0.04;
export const MIN_PAGE_WEIGHT = 0.5;
export const MAX_PAGE_WEIGHT = 1.8;
const WEAK_GRIP_COMPRESSION_PER_PAGE = 0.2;
export const SLOW_COMMIT_EDGE_X =
  MIN_PRESSED_EDGE_X - pressedRollHingeGeometry().tiltDistance;
export const GESTURE_LIFT_START_X = 0.36;
/** Kept as the side-view tuning value; it no longer eases gesture distance. */
export const GESTURE_HINGE_BLEND_WIDTH_X = 0.11;
/** Fraction of the full stable-hinge tilt reached at the visual spine. */
export const GESTURE_ROLL_TILT_RATE = 0.4;
export const GESTURE_HINGE_ROTATION =
  MAX_PRESSED_ROLL_TILT * GESTURE_ROLL_TILT_RATE;
/** The visible free edge remains exactly 0.14W at this rotated chord. */
export const GESTURE_HINGE_CHORD_X =
  MIN_PRESSED_EDGE_X / Math.cos(GESTURE_HINGE_ROTATION);
const GESTURE_HINGE_BEND_AMPLITUDE = 2.1266855842119465;
const COMMIT_VELOCITY_LIMIT = 3.2;
const COMMIT_ACCELERATION_LIMIT = 10;
const COMMIT_VELOCITY_GAIN = 0.18;
const COMMIT_ACCELERATION_GAIN = 0.035;

export function clampPageTurnTuning(tuning: PageTurnTuning): PageTurnTuning {
  const gestureMinimumSpeedScale = clamp(
    tuning.gestureMinimumSpeedScale,
    0.5,
    1.5,
  );
  return {
    releaseX: clamp(tuning.releaseX, 0.58, 0.8),
    liftVelocity: clamp(tuning.liftVelocity, 0.7, 1.8),
    liftToLeft: clamp(tuning.liftToLeft, 1.4, 2.6),
    curvatureRelaxation: clamp(tuning.curvatureRelaxation, 3.5, 14),
    pageWeight: clampPageWeight(tuning.pageWeight),
    gestureCommitThreshold: clamp(tuning.gestureCommitThreshold, 0.4, 1.2),
    gestureMinimumSpeedScale,
    gestureMaximumSpeedScale: clamp(
      tuning.gestureMaximumSpeedScale,
      gestureMinimumSpeedScale,
      3,
    ),
    gestureVelocityGain: clamp(tuning.gestureVelocityGain, 0.1, 1.2),
    gestureIdleDecaySeconds: clamp(tuning.gestureIdleDecaySeconds, 0.03, 0.2),
  };
}

export function clampPageWeight(pageWeight: number): number {
  const safeWeight = Number.isFinite(pageWeight)
    ? pageWeight
    : DEFAULT_PAGE_TURN_TUNING.pageWeight;
  return clamp(safeWeight, MIN_PAGE_WEIGHT, MAX_PAGE_WEIGHT);
}

export function turnPropagationSpeed(tuning: PageTurnTuning): number {
  const safe = clampPageTurnTuning(tuning);
  return safe.liftVelocity * safe.liftToLeft;
}

export function gestureTurnSpeedScale(
  throwVelocity: number,
  tuning: PageTurnTuning = DEFAULT_PAGE_TURN_TUNING,
): number {
  const safeVelocity = Number.isFinite(throwVelocity)
    ? Math.max(0, throwVelocity)
    : 0;
  const safe = clampPageTurnTuning(tuning);
  return clamp(
    safe.gestureMinimumSpeedScale + safeVelocity * safe.gestureVelocityGain,
    safe.gestureMinimumSpeedScale,
    safe.gestureMaximumSpeedScale,
  );
}

export function turnCommitScore(input: TurnCommitInput): number {
  const distance = clamp(
    (1 - input.fingerX) / (1 - SLOW_COMMIT_EDGE_X),
    0,
    1.2,
  );
  const velocity =
    clamp(input.throwVelocity, 0, COMMIT_VELOCITY_LIMIT) * COMMIT_VELOCITY_GAIN;
  const acceleration =
    clamp(input.throwAcceleration, 0, COMMIT_ACCELERATION_LIMIT) *
    COMMIT_ACCELERATION_GAIN;
  return (
    (distance + velocity + acceleration) / clampPageWeight(input.pageWeight)
  );
}

export function shouldCommitTurn(
  input: TurnCommitInput,
  tuning: PageTurnTuning = DEFAULT_PAGE_TURN_TUNING,
): boolean {
  return (
    turnCommitScore(input) >=
    clampPageTurnTuning(tuning).gestureCommitThreshold - 1e-6
  );
}

export function pageGestureModeForStart(
  startBookX: number,
): PageGestureMode | null {
  if (!Number.isFinite(startBookX) || startBookX < 0 || startBookX > 1) {
    return null;
  }
  return startBookX >= FULL_GESTURE_START_MIN_X ? "full" : "weak";
}

export function anchoredGestureFingerX(
  startBookX: number,
  currentBookX: number,
): number {
  const safeStart = Number.isFinite(startBookX) ? startBookX : 1;
  const safeCurrent = Number.isFinite(currentBookX) ? currentBookX : safeStart;
  return clamp(1 + safeCurrent - safeStart, -1, 1);
}

/**
 * Converts travel beyond the fully closed roll into the outgoing page's
 * rotation-and-unroll phase. The start position normalizes the distance that
 * remains between the hinge and the opposite outer edge, so the full visible
 * spread remains active even when the finger starts inboard of the page edge.
 */
export function postHingeTurnProgressForFingerX(
  fingerX: number,
  startBookX = 1,
  curvatureRelaxation = DEFAULT_CURVATURE_RELAXATION,
): number {
  "worklet";
  const safeFingerX = Number.isFinite(fingerX)
    ? Math.min(1, Math.max(-1, fingerX))
    : MIN_PRESSED_EDGE_X;
  const safeStartBookX = Number.isFinite(startBookX)
    ? Math.min(1, Math.max(0, startBookX))
    : 1;
  const linearProgress = Math.min(
    1,
    Math.max(
      0,
      (MIN_PRESSED_EDGE_X - safeFingerX) /
        (MIN_PRESSED_EDGE_X + safeStartBookX),
    ),
  );
  if (linearProgress <= 0 || linearProgress >= 1) {
    return linearProgress;
  }

  // The physical turn has a swing phase followed by a curl-release phase, so
  // its raw progress does not rotate the cylinder at a constant rate. Invert
  // those two analytic branches: the profile rotation itself, rather than an
  // abstract progress value, now follows horizontal hand travel exactly.
  const desiredRotation =
    GESTURE_HINGE_ROTATION +
    (Math.PI - GESTURE_HINGE_ROTATION) * linearProgress;
  const rootTangent = GESTURE_HINGE_ROTATION + GESTURE_HINGE_BEND_AMPLITUDE;
  const swingAngle = Math.max(0, Math.PI - rootTangent);
  const swingProgress = swingAngle / Math.PI;
  const landingStart = swingProgress / (swingProgress + 1);
  const landingRotation = Math.PI - GESTURE_HINGE_BEND_AMPLITUDE;
  if (desiredRotation <= landingRotation && swingAngle > 1e-9) {
    return (
      landingStart * ((desiredRotation - GESTURE_HINGE_ROTATION) / swingAngle)
    );
  }

  const relaxation = Math.min(
    14,
    Math.max(
      3.5,
      Number.isFinite(curvatureRelaxation)
        ? curvatureRelaxation
        : DEFAULT_CURVATURE_RELAXATION,
    ),
  );
  const curlRetention = Math.min(
    1,
    Math.max(0, (Math.PI - desiredRotation) / GESTURE_HINGE_BEND_AMPLITUDE),
  );
  const remainingAirborne = Math.pow(curlRetention, 1 / (1 + relaxation / 14));
  const landedLength = 1 - remainingAirborne;
  return landingStart + landedLength * (1 - landingStart);
}

export function slowCommitBookXForStart(
  startBookX: number,
  pageWeight = DEFAULT_PAGE_TURN_TUNING.pageWeight,
): number {
  const safeStart = Number.isFinite(startBookX) ? startBookX : 1;
  return safeStart - clampPageWeight(pageWeight) * (1 - SLOW_COMMIT_EDGE_X);
}

export function weakGripPressedEdgeX(
  startBookX: number,
  currentBookX: number,
): number {
  const safeStart = Number.isFinite(startBookX) ? startBookX : 0;
  const safeCurrent = Number.isFinite(currentBookX) ? currentBookX : safeStart;
  const leftwardTravel = Math.max(0, safeStart - safeCurrent);
  const compression = Math.min(
    WEAK_GRIP_MAX_COMPRESSION,
    leftwardTravel * WEAK_GRIP_COMPRESSION_PER_PAGE,
  );
  return 1 - compression;
}

export function heldRollTiltForFingerX(fingerX: number): number {
  const hinge = pressedRollHingeGeometry();
  const safeFingerX = Number.isFinite(fingerX) ? fingerX : MIN_PRESSED_EDGE_X;
  const displacement = clamp(
    MIN_PRESSED_EDGE_X - safeFingerX,
    0,
    hinge.tiltDistance,
  );
  const radius = Math.hypot(hinge.apexX, hinge.apexZ);
  const initialAngle = Math.atan2(hinge.apexZ, hinge.apexX);
  const rotatedAngle = Math.acos(
    clamp((hinge.apexX - displacement) / radius, -1, 1),
  );
  return clamp(rotatedAngle - initialAngle, 0, MAX_PRESSED_ROLL_TILT);
}

/**
 * Starts lifting when the free edge reaches the selected horizontal trigger.
 * Rotation is affine to the finger's x position while the finger is down. The
 * hinge pose is therefore reached without a hidden ease or acceleration band.
 */
export function gestureLiftRotationForFingerX(fingerX: number): number {
  const safeFingerX = Number.isFinite(fingerX) ? fingerX : 1;
  if (safeFingerX <= MIN_PRESSED_EDGE_X) {
    return GESTURE_HINGE_ROTATION;
  }
  const progress = clamp(
    (GESTURE_LIFT_START_X - safeFingerX) /
      (GESTURE_LIFT_START_X - MIN_PRESSED_EDGE_X),
    0,
    1,
  );
  return GESTURE_HINGE_ROTATION * progress;
}

/**
 * Compensates for the x projection lost when the roll tilts. This keeps the
 * visible free edge directly under the hand before it reaches the spine.
 */
export function gesturePressedChordForFingerX(
  fingerX: number,
  rotation = gestureLiftRotationForFingerX(fingerX),
): number {
  "worklet";
  const safeFingerX = Number.isFinite(fingerX) ? fingerX : 1;
  if (safeFingerX <= MIN_PRESSED_EDGE_X) {
    return GESTURE_HINGE_CHORD_X;
  }
  const targetEdgeX = clamp(safeFingerX, MIN_PRESSED_EDGE_X, 1);
  return clamp(
    targetEdgeX / Math.max(0.000001, Math.cos(rotation)),
    MIN_PRESSED_EDGE_X,
    1,
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
