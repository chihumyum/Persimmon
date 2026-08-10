import {
  DEFAULT_CURVATURE_RELAXATION,
  MAX_CURVATURE_RELAXATION,
  MAX_PRESSED_ROLL_TILT,
  MIN_CURVATURE_RELAXATION,
  MIN_PRESSED_EDGE_X,
  pressedRollHingeGeometry,
} from "./rolled-page-strip";

export interface IncomingPageTurnTuning {
  incomingLandingStartProgress: number;
  incomingRevealStartProgress: number;
  incomingRevealEndProgress: number;
  incomingDragProgressScale: number;
  incomingDragProgressExponent: number;
  incomingSettleDurationSeconds: number;
  incomingSettleEasingPower: number;
  incomingRevertDurationSeconds: number;
}

export interface PageTurnTuning extends Partial<IncomingPageTurnTuning> {
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
  incomingLandingStartProgress: 0.3,
  incomingRevealStartProgress: 0,
  incomingRevealEndProgress: 0.28,
  incomingDragProgressScale: 1,
  incomingDragProgressExponent: 1,
  incomingSettleDurationSeconds: 0.52,
  incomingSettleEasingPower: 2,
  incomingRevertDurationSeconds: 0.72,
};

export const DEFAULT_INCOMING_PAGE_TURN_TUNING: IncomingPageTurnTuning = {
  incomingLandingStartProgress: 0.3,
  incomingRevealStartProgress: 0,
  incomingRevealEndProgress: 0.28,
  incomingDragProgressScale: 1,
  incomingDragProgressExponent: 1,
  incomingSettleDurationSeconds: 0.52,
  incomingSettleEasingPower: 2,
  incomingRevertDurationSeconds: 0.72,
};

/** Only the quarter of a page nearest the spine uses the weak-grip response. */
export const FULL_GESTURE_START_MIN_X = 0.25;
export const WEAK_GRIP_MAX_COMPRESSION = 0.04;
export const MIN_PAGE_TURN_RELEASE_X = 0.15;
export const MAX_PAGE_TURN_RELEASE_X = 1;
export const MIN_PAGE_TURN_LIFT_VELOCITY = 0.1;
export const MAX_PAGE_TURN_LIFT_VELOCITY = 5;
export const MIN_PAGE_TURN_LIFT_TO_LEFT = 0.25;
export const MAX_PAGE_TURN_LIFT_TO_LEFT = 6;
export const MIN_PAGE_WEIGHT = 0.1;
export const MAX_PAGE_WEIGHT = 6;
export const MIN_GESTURE_COMMIT_THRESHOLD = 0.05;
export const MAX_GESTURE_COMMIT_THRESHOLD = 3;
export const MIN_GESTURE_SPEED_SCALE = 0.1;
export const MAX_GESTURE_MINIMUM_SPEED_SCALE = 4;
export const MAX_GESTURE_SPEED_SCALE = 8;
export const MIN_GESTURE_VELOCITY_GAIN = 0;
export const MAX_GESTURE_VELOCITY_GAIN = 4;
export const MIN_GESTURE_IDLE_DECAY_SECONDS = 0.005;
export const MAX_GESTURE_IDLE_DECAY_SECONDS = 1;
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

export function clampPageTurnTuning(
  tuning: PageTurnTuning,
  maximumReleaseX = MAX_PAGE_TURN_RELEASE_X,
): PageTurnTuning {
  const gestureMinimumSpeedScale = clamp(
    tuning.gestureMinimumSpeedScale,
    MIN_GESTURE_SPEED_SCALE,
    MAX_GESTURE_MINIMUM_SPEED_SCALE,
  );
  const safeMaximumReleaseX = clamp(
    maximumReleaseX,
    MIN_PAGE_TURN_RELEASE_X,
    MAX_PAGE_TURN_RELEASE_X,
  );
  const incoming = clampIncomingPageTurnTuning(tuning);
  return {
    releaseX: clamp(
      tuning.releaseX,
      MIN_PAGE_TURN_RELEASE_X,
      safeMaximumReleaseX,
    ),
    liftVelocity: clamp(
      tuning.liftVelocity,
      MIN_PAGE_TURN_LIFT_VELOCITY,
      MAX_PAGE_TURN_LIFT_VELOCITY,
    ),
    liftToLeft: clamp(
      tuning.liftToLeft,
      MIN_PAGE_TURN_LIFT_TO_LEFT,
      MAX_PAGE_TURN_LIFT_TO_LEFT,
    ),
    curvatureRelaxation: clamp(
      tuning.curvatureRelaxation,
      MIN_CURVATURE_RELAXATION,
      MAX_CURVATURE_RELAXATION,
    ),
    pageWeight: clampPageWeight(tuning.pageWeight),
    gestureCommitThreshold: clamp(
      tuning.gestureCommitThreshold,
      MIN_GESTURE_COMMIT_THRESHOLD,
      MAX_GESTURE_COMMIT_THRESHOLD,
    ),
    gestureMinimumSpeedScale,
    gestureMaximumSpeedScale: clamp(
      tuning.gestureMaximumSpeedScale,
      gestureMinimumSpeedScale,
      MAX_GESTURE_SPEED_SCALE,
    ),
    gestureVelocityGain: clamp(
      tuning.gestureVelocityGain,
      MIN_GESTURE_VELOCITY_GAIN,
      MAX_GESTURE_VELOCITY_GAIN,
    ),
    gestureIdleDecaySeconds: clamp(
      tuning.gestureIdleDecaySeconds,
      MIN_GESTURE_IDLE_DECAY_SECONDS,
      MAX_GESTURE_IDLE_DECAY_SECONDS,
    ),
    ...incoming,
  };
}

export function clampIncomingPageTurnTuning(
  tuning: Partial<IncomingPageTurnTuning>,
): IncomingPageTurnTuning {
  const revealStart = clamp(
    finiteOrDefault(
      tuning.incomingRevealStartProgress,
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealStartProgress,
    ),
    0,
    0.85,
  );
  const revealEnd = clamp(
    finiteOrDefault(
      tuning.incomingRevealEndProgress,
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealEndProgress,
    ),
    revealStart + 0.02,
    0.95,
  );
  return {
    incomingLandingStartProgress: clamp(
      finiteOrDefault(
        tuning.incomingLandingStartProgress,
        DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingLandingStartProgress,
      ),
      0.05,
      0.85,
    ),
    incomingRevealStartProgress: revealStart,
    incomingRevealEndProgress: revealEnd,
    incomingDragProgressScale: clamp(
      finiteOrDefault(
        tuning.incomingDragProgressScale,
        DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingDragProgressScale,
      ),
      0.25,
      3,
    ),
    incomingDragProgressExponent: clamp(
      finiteOrDefault(
        tuning.incomingDragProgressExponent,
        DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingDragProgressExponent,
      ),
      0.35,
      3,
    ),
    incomingSettleDurationSeconds: clamp(
      finiteOrDefault(
        tuning.incomingSettleDurationSeconds,
        DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleDurationSeconds,
      ),
      0.15,
      1.5,
    ),
    incomingSettleEasingPower: clamp(
      finiteOrDefault(
        tuning.incomingSettleEasingPower,
        DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleEasingPower,
      ),
      0.75,
      6,
    ),
    incomingRevertDurationSeconds: clamp(
      finiteOrDefault(
        tuning.incomingRevertDurationSeconds,
        DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevertDurationSeconds,
      ),
      0.1,
      1.5,
    ),
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
    MAX_CURVATURE_RELAXATION,
    Math.max(
      MIN_CURVATURE_RELAXATION,
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

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
