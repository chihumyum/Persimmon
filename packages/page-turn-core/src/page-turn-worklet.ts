import {
  DEFAULT_PAGE_TURN_TUNING,
  GESTURE_HINGE_CHORD_X,
  GESTURE_HINGE_ROTATION,
  type ReleasedPageTurnGesture,
  type PageTurnTuning,
} from "./page-turn-gesture";
import {
  DEFAULT_PAGE_PROFILE_POINTS,
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  PROFILE_QUADRATURE_OFFSET,
  turnCurlRetention,
  turnCurvatureUniformity,
  turnLandingStart,
} from "./rolled-page-strip";
import {
  AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS,
  INCOMING_PAGE_SETTLE_DURATION_SECONDS,
  PAGE_TURN_PROPAGATION_SPEED_SCALE,
} from "./page-turn-timing";

export const PAGE_TURN_WORKLET_IDLE = 0;
export const PAGE_TURN_WORKLET_DRAG = 1;
export const PAGE_TURN_WORKLET_PRESS = 2;
export const PAGE_TURN_WORKLET_TURN = 3;
export const PAGE_TURN_WORKLET_SETTLE = 4;
export const PAGE_TURN_WORKLET_REVERT = 5;
export const PAGE_TURN_WORKLET_COMPLETED = 6;

export const PAGE_TURN_WORKLET_NO_OUTCOME = 0;
export const PAGE_TURN_WORKLET_COMMITTED = 1;
export const PAGE_TURN_WORKLET_REVERTED = -1;

const PROFILE_FLOATS_PER_POINT = 4;
const PROFILE_X = 0;
const PROFILE_Z = 1;
const PROFILE_NORMAL_X = 2;
const PROFILE_NORMAL_Z = 3;
const PROFILE_SEGMENTS = DEFAULT_PAGE_PROFILE_POINTS - 1;
const PROFILE_QUADRATURE_NODES = PROFILE_SEGMENTS * 2;
const MAX_PROFILE_BEND_AMPLITUDE = 2.147033481101353;
const SETTLING_PAGE_START_PROGRESS = 0.3;
const GESTURE_VELOCITY_TIME_CONSTANT = 0.045;
const GESTURE_ACCELERATION_TIME_CONSTANT = 0.06;
const MAX_TRACKED_GESTURE_VELOCITY = 6;
const MAX_TRACKED_GESTURE_ACCELERATION = 20;
// Keep aligned with page-turn-gesture without capturing an imported constant
// inside the UI Worklet runtime.
const FULL_GESTURE_START_MIN_X = 0.25;
const WEAK_GRIP_MAX_COMPRESSION = 0.04;
const WEAK_GRIP_COMPRESSION_PER_PAGE = 0.2;
const MIN_PAGE_WEIGHT = 0.5;
const MAX_PAGE_WEIGHT = 1.8;
// The app-level tuning floor is 0.4. Keep the solver floor below its iOS
// two-thirds scale so the platform adjustment is not silently clamped away.
const MIN_GESTURE_COMMIT_THRESHOLD = 0.25;
const MAX_GESTURE_COMMIT_THRESHOLD = 1.2;
const COMMIT_VELOCITY_LIMIT = 3.2;
const COMMIT_ACCELERATION_LIMIT = 10;
const COMMIT_VELOCITY_GAIN = 0.18;
const COMMIT_ACCELERATION_GAIN = 0.035;
const MIN_REVERT_INITIAL_SPEED = 0.65;
const MAX_REVERT_INITIAL_SPEED = 6.3;
const REVERT_EASE_OUT_INITIAL_SLOPE = 3;

// Inverse J0 on the approximation's original chord interval [0.035, 1].
// This degree-10 Chebyshev approximation has < 9e-8 radians maximum error
// against the old 48 x 256 bisection/integration solver. It removes more than
// twelve thousand cosine evaluations from every drag update.
const INVERSE_BESSEL_CHEBYSHEV = [
  2.1667709839070377, -0.18629174453685354, 0.02265270180455248,
  -0.0037165828681793253, 0.0007038952663799921, -0.00014500246546194032,
  0.000031566578791633, -0.000007135535298704449, 0.0000016623788064225635,
  -0.0000003841457726910674, 0.00000009309814723863693,
] as const;
const INVERSE_BESSEL_APPROXIMATION_MIN_CHORD = 0.035;

// Stable geometry of the fully compressed reference hinge.
const PRESSED_HINGE_TILT_DISTANCE = 0.3565937167398107;
const GESTURE_LIFT_START_X = 0.36;
const GESTURE_ROLL_TILT_RATE = 0.4;
const GESTURE_HINGE_BEND_AMPLITUDE = 2.1266855842119465;
const SLOW_COMMIT_EDGE_X = MIN_PRESSED_EDGE_X - PRESSED_HINGE_TILT_DISTANCE;

/**
 * Material coordinate of every quadrature node, fixed for the life of the app.
 *
 * The curl mode itself can no longer be tabulated against these: once paper
 * starts landing, the mode is evaluated over the material that has not landed
 * yet, so its argument moves every frame. A frame therefore costs one cosine
 * for the mode plus one sin/cos pair for the tangent at each airborne node,
 * and only the sin/cos pair at each landed node.
 *
 * This replaces the old bend-amplitude lookup table, which could not express
 * either curvature distribution or a moving contact. Integrating two
 * Gauss-Legendre nodes per segment reproduces that table's 8-substep midpoint
 * shape to within 1.2e-6 page widths and drops a 131 KB buffer plus its
 * module-load integration.
 */
const QUADRATURE_MATERIAL = createQuadratureMaterial();

function createQuadratureMaterial(): Float64Array {
  const samples = new Float64Array(PROFILE_QUADRATURE_NODES);
  for (let segment = 0; segment < PROFILE_SEGMENTS; segment += 1) {
    for (let node = 0; node < 2; node += 1) {
      samples[segment * 2 + node] =
        (segment + 0.5 + (node === 0 ? -1 : 1) * PROFILE_QUADRATURE_OFFSET) /
        PROFILE_SEGMENTS;
    }
  }
  return samples;
}

export interface PageTurnWorkletState {
  phase: number;
  outcome: number;
  outcomeNotified: boolean;
  direction: 1 | -1;
  settlingIncomingPage: boolean;

  tuningReleaseX: number;
  tuningLiftVelocity: number;
  tuningLiftToLeft: number;
  tuningCurvatureRelaxation: number;
  tuningPageWeight: number;
  tuningGestureCommitThreshold: number;
  tuningGestureMinimumSpeedScale: number;
  tuningGestureMaximumSpeedScale: number;
  tuningGestureVelocityGain: number;
  tuningGestureIdleDecaySeconds: number;

  startBookX: number;
  lastBookX: number;
  lastBookY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  throwAcceleration: number;
  gestureFingerX: number;
  pressedEdgeX: number;
  heldRollTilt: number;
  weakGrip: boolean;
  dragTurnProgress: number;
  settlingProgress: number;

  driveElapsed: number;
  driveStartX: number;
  driveSpeedScale: number;
  driveStartProgress: number;
  driveStartRotation: number;
  revertPressedStartX: number;
  revertCompleteness: number;
  revertStartRotation: number;

  maxLift: number;
  meanSpeed: number;
  edgeVelocityX: number;
  curvature: number;
  flatteningRate: number;
  profile: Float32Array;
  previousX: Float32Array;
  previousZ: Float32Array;
}

export function createPageTurnWorkletState(
  tuning: PageTurnTuning = DEFAULT_PAGE_TURN_TUNING,
): PageTurnWorkletState {
  const state: PageTurnWorkletState = {
    phase: PAGE_TURN_WORKLET_IDLE,
    outcome: PAGE_TURN_WORKLET_NO_OUTCOME,
    outcomeNotified: false,
    direction: 1,
    settlingIncomingPage: false,

    tuningReleaseX: clamp(tuning.releaseX, 0.58, 0.8),
    tuningLiftVelocity: clamp(tuning.liftVelocity, 0.7, 1.8),
    tuningLiftToLeft: clamp(tuning.liftToLeft, 1.4, 2.6),
    tuningCurvatureRelaxation: clamp(tuning.curvatureRelaxation, 3.5, 14),
    tuningPageWeight: clamp(
      tuning.pageWeight,
      MIN_PAGE_WEIGHT,
      MAX_PAGE_WEIGHT,
    ),
    tuningGestureCommitThreshold: clamp(
      tuning.gestureCommitThreshold,
      MIN_GESTURE_COMMIT_THRESHOLD,
      MAX_GESTURE_COMMIT_THRESHOLD,
    ),
    tuningGestureMinimumSpeedScale: clamp(
      tuning.gestureMinimumSpeedScale,
      0.5,
      1.5,
    ),
    tuningGestureMaximumSpeedScale: clamp(
      tuning.gestureMaximumSpeedScale,
      clamp(tuning.gestureMinimumSpeedScale, 0.5, 1.5),
      3,
    ),
    tuningGestureVelocityGain: clamp(tuning.gestureVelocityGain, 0.1, 1.2),
    tuningGestureIdleDecaySeconds: clamp(
      tuning.gestureIdleDecaySeconds,
      0.03,
      0.2,
    ),

    startBookX: 1,
    lastBookX: 1,
    lastBookY: 0.5,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
    throwAcceleration: 0,
    gestureFingerX: 1,
    pressedEdgeX: 1,
    heldRollTilt: 0,
    weakGrip: false,
    dragTurnProgress: 0,
    settlingProgress: 0,

    driveElapsed: 0,
    driveStartX: tuning.releaseX,
    driveSpeedScale: 1,
    driveStartProgress: 0,
    driveStartRotation: 0,
    revertPressedStartX: tuning.releaseX,
    revertCompleteness: 0,
    revertStartRotation: 0,

    maxLift: 0,
    meanSpeed: 0,
    edgeVelocityX: 0,
    curvature: 0,
    flatteningRate: 0,
    profile: new Float32Array(
      DEFAULT_PAGE_PROFILE_POINTS * PROFILE_FLOATS_PER_POINT,
    ),
    previousX: new Float32Array(DEFAULT_PAGE_PROFILE_POINTS),
    previousZ: new Float32Array(DEFAULT_PAGE_PROFILE_POINTS),
  };
  // Do not call a compiled worklet from the RN runtime during hook
  // initialization. Worklet helper closures only exist after installation in
  // the UI runtime. The state starts flat, so initialize that fixed buffer
  // directly here and reserve resetPageTurnWorklet() for UI-runtime calls.
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    const material = index / (DEFAULT_PAGE_PROFILE_POINTS - 1);
    state.profile[offset + PROFILE_X] = material;
    state.profile[offset + PROFILE_Z] = 0;
    state.profile[offset + PROFILE_NORMAL_X] = 0;
    state.profile[offset + PROFILE_NORMAL_Z] = 1;
    state.previousX[index] = material;
    state.previousZ[index] = 0;
  }
  return state;
}

export function setPageTurnWorkletTuning(
  state: PageTurnWorkletState,
  tuning: PageTurnTuning,
): void {
  "worklet";
  state.tuningReleaseX = Math.min(0.8, Math.max(0.58, tuning.releaseX));
  state.tuningLiftVelocity = Math.min(1.8, Math.max(0.7, tuning.liftVelocity));
  state.tuningLiftToLeft = Math.min(2.6, Math.max(1.4, tuning.liftToLeft));
  state.tuningCurvatureRelaxation = Math.min(
    14,
    Math.max(3.5, tuning.curvatureRelaxation),
  );
  state.tuningPageWeight = Math.min(
    MAX_PAGE_WEIGHT,
    Math.max(MIN_PAGE_WEIGHT, tuning.pageWeight),
  );
  state.tuningGestureCommitThreshold = Math.min(
    MAX_GESTURE_COMMIT_THRESHOLD,
    Math.max(MIN_GESTURE_COMMIT_THRESHOLD, tuning.gestureCommitThreshold),
  );
  state.tuningGestureMinimumSpeedScale = Math.min(
    1.5,
    Math.max(0.5, tuning.gestureMinimumSpeedScale),
  );
  state.tuningGestureMaximumSpeedScale = Math.min(
    3,
    Math.max(
      state.tuningGestureMinimumSpeedScale,
      tuning.gestureMaximumSpeedScale,
    ),
  );
  state.tuningGestureVelocityGain = Math.min(
    1.2,
    Math.max(0.1, tuning.gestureVelocityGain),
  );
  state.tuningGestureIdleDecaySeconds = Math.min(
    0.2,
    Math.max(0.03, tuning.gestureIdleDecaySeconds),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}

function safeTime(time: number): number {
  "worklet";
  return Number.isFinite(time) ? time : 0;
}

function landingTurnProgress(progress: number): number {
  "worklet";
  return (
    SETTLING_PAGE_START_PROGRESS +
    (1 - SETTLING_PAGE_START_PROGRESS) * clamp(progress, 0, 1)
  );
}

function gestureTurnSpeedScale(
  state: PageTurnWorkletState,
  throwVelocity: number,
): number {
  "worklet";
  return clamp(
    state.tuningGestureMinimumSpeedScale +
      Math.max(0, throwVelocity) * state.tuningGestureVelocityGain,
    state.tuningGestureMinimumSpeedScale,
    state.tuningGestureMaximumSpeedScale,
  );
}

function gestureThrowVelocity(state: PageTurnWorkletState): number {
  "worklet";
  const leftwardVelocity = Math.max(0, -state.velocityX);
  const upwardVelocity = Math.max(0, -state.velocityY);
  return Math.hypot(leftwardVelocity, upwardVelocity * 0.75);
}

function revertDuration(startEdgeX: number, completeness: number): number {
  "worklet";
  const distance = Math.max(0, 1 - clamp(startEdgeX, 0, 1));
  if (distance <= 1e-8) {
    return 0;
  }
  const initialSpeed =
    MIN_REVERT_INITIAL_SPEED +
    (MAX_REVERT_INITIAL_SPEED - MIN_REVERT_INITIAL_SPEED) *
      clamp(completeness, 0, 1);
  return (REVERT_EASE_OUT_INITIAL_SLOPE * distance) / initialSpeed;
}

function bendAmplitudeForChord(chord: number): number {
  "worklet";
  if (chord >= 0.999999) {
    return 0;
  }
  const safeChord = clamp(chord, MIN_PRESSED_EDGE_X, 0.999999);
  const x =
    (2 * (safeChord - INVERSE_BESSEL_APPROXIMATION_MIN_CHORD)) /
      (1 - INVERSE_BESSEL_APPROXIMATION_MIN_CHORD) -
    1;
  let beforePrevious = 0;
  let previous = 0;
  for (
    let index = INVERSE_BESSEL_CHEBYSHEV.length - 1;
    index >= 1;
    index -= 1
  ) {
    const current =
      2 * x * previous - beforePrevious + INVERSE_BESSEL_CHEBYSHEV[index]!;
    beforePrevious = previous;
    previous = current;
  }
  const normalized =
    x * previous - beforePrevious + INVERSE_BESSEL_CHEBYSHEV[0]!;
  return normalized * Math.sqrt(Math.max(0, 1 - safeChord));
}

function gestureLiftRotationForFingerX(fingerX: number): number {
  "worklet";
  if (fingerX <= MIN_PRESSED_EDGE_X) {
    return GESTURE_HINGE_ROTATION;
  }
  const progress = clamp(
    (GESTURE_LIFT_START_X - fingerX) /
      (GESTURE_LIFT_START_X - MIN_PRESSED_EDGE_X),
    0,
    1,
  );
  return MAX_PRESSED_ROLL_TILT * GESTURE_ROLL_TILT_RATE * progress;
}

function gesturePressedChordForFingerX(
  fingerX: number,
  rotation: number,
): number {
  "worklet";
  if (fingerX <= MIN_PRESSED_EDGE_X) {
    return GESTURE_HINGE_CHORD_X;
  }
  const targetEdgeX = clamp(fingerX, MIN_PRESSED_EDGE_X, 1);
  return clamp(
    targetEdgeX / Math.max(0.000001, Math.cos(rotation)),
    MIN_PRESSED_EDGE_X,
    1,
  );
}

function slowCommitEdgeX(): number {
  "worklet";
  return SLOW_COMMIT_EDGE_X;
}

function pressedRollCompleteness(edgeX: number): number {
  "worklet";
  const safeEdgeX = clamp(edgeX, MIN_PRESSED_EDGE_X, 1);
  if (safeEdgeX >= 0.999999) {
    return 0;
  }
  return clamp(
    bendAmplitudeForChord(safeEdgeX) /
      bendAmplitudeForChord(MIN_PRESSED_EDGE_X),
    0,
    1,
  );
}

function setFlatProfile(state: PageTurnWorkletState): void {
  "worklet";
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    const material = index / (DEFAULT_PAGE_PROFILE_POINTS - 1);
    state.profile[offset + PROFILE_X] = material;
    state.profile[offset + PROFILE_Z] = 0;
    state.profile[offset + PROFILE_NORMAL_X] = 0;
    state.profile[offset + PROFILE_NORMAL_Z] = 1;
    state.previousX[index] = material;
    state.previousZ[index] = 0;
  }
  state.maxLift = 0;
  state.meanSpeed = 0;
  state.edgeVelocityX = 0;
  state.curvature = 0;
  state.flatteningRate = 0;
}

function curlTangentAngle(
  material: number,
  rotation: number,
  bendAmplitude: number,
  curvatureUniformity: number,
  landedLength: number,
): number {
  "worklet";
  const airborne = 1 - landedLength;
  if (landedLength > 0 && (material <= landedLength || airborne <= 1e-9)) {
    return Math.PI;
  }
  const curl =
    landedLength > 0 ? (material - landedLength) / airborne : material;
  const pinned = Math.cos(Math.PI * curl);
  return (
    rotation +
    bendAmplitude * (pinned + curvatureUniformity * (1 - 2 * curl - pinned))
  );
}

function rebuildProfile(
  state: PageTurnWorkletState,
  rotation: number,
  bendAmplitude: number,
  curvatureUniformity: number,
  landedLength: number,
  deltaTime: number,
): void {
  "worklet";
  const profile = state.profile;
  const previousCurvature = state.curvature;
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    state.previousX[index] = profile[offset + PROFILE_X]!;
    state.previousZ[index] = profile[offset + PROFILE_Z]!;
  }

  let maxLift = 0;
  const amplitude = clamp(bendAmplitude, 0, MAX_PROFILE_BEND_AMPLITUDE);
  const uniformity = clamp(curvatureUniformity, 0, 1);
  const landed = clamp(landedLength, 0, 1);
  const quadratureWeight = 0.5 / PROFILE_SEGMENTS;
  let x = 0;
  let z = 0;
  profile[PROFILE_X] = 0;
  profile[PROFILE_Z] = 0;
  for (let segment = 0; segment < PROFILE_SEGMENTS; segment += 1) {
    const node = segment * 2;
    const firstAngle = curlTangentAngle(
      QUADRATURE_MATERIAL[node]!,
      rotation,
      amplitude,
      uniformity,
      landed,
    );
    const secondAngle = curlTangentAngle(
      QUADRATURE_MATERIAL[node + 1]!,
      rotation,
      amplitude,
      uniformity,
      landed,
    );
    x += (Math.cos(firstAngle) + Math.cos(secondAngle)) * quadratureWeight;
    z += (Math.sin(firstAngle) + Math.sin(secondAngle)) * quadratureWeight;
    const offset = (segment + 1) * PROFILE_FLOATS_PER_POINT;
    profile[offset + PROFILE_X] = Math.abs(x) < 1e-10 ? 0 : x;
    profile[offset + PROFILE_Z] = Math.abs(z) < 1e-10 ? 0 : z;
    maxLift = Math.max(maxLift, z);
  }

  let speedSum = 0;
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const beforeIndex = Math.max(0, index - 1);
    const afterIndex = Math.min(DEFAULT_PAGE_PROFILE_POINTS - 1, index + 1);
    const beforeOffset = beforeIndex * PROFILE_FLOATS_PER_POINT;
    const offset = index * PROFILE_FLOATS_PER_POINT;
    const afterOffset = afterIndex * PROFILE_FLOATS_PER_POINT;
    const tangentX =
      profile[afterOffset + PROFILE_X]! - profile[beforeOffset + PROFILE_X]!;
    const tangentZ =
      profile[afterOffset + PROFILE_Z]! - profile[beforeOffset + PROFILE_Z]!;
    const tangentLength = Math.max(1e-7, Math.hypot(tangentX, tangentZ));
    profile[offset + PROFILE_NORMAL_X] = -tangentZ / tangentLength;
    profile[offset + PROFILE_NORMAL_Z] = tangentX / tangentLength;
    if (deltaTime > 0) {
      speedSum +=
        Math.hypot(
          profile[offset + PROFILE_X]! - state.previousX[index]!,
          profile[offset + PROFILE_Z]! - state.previousZ[index]!,
        ) / deltaTime;
    }
  }
  state.maxLift = maxLift;
  state.meanSpeed = deltaTime > 0 ? speedSum / DEFAULT_PAGE_PROFILE_POINTS : 0;
  const edgeOffset =
    (DEFAULT_PAGE_PROFILE_POINTS - 1) * PROFILE_FLOATS_PER_POINT;
  state.edgeVelocityX =
    deltaTime > 0
      ? (profile[edgeOffset + PROFILE_X]! -
          state.previousX[DEFAULT_PAGE_PROFILE_POINTS - 1]!) /
        deltaTime
      : 0;
  state.curvature = Math.abs(bendAmplitude);
  state.flatteningRate =
    deltaTime > 0
      ? Math.max(0, (previousCurvature - state.curvature) / deltaTime)
      : 0;
}

function rebuildPressedProfile(
  state: PageTurnWorkletState,
  edgeX: number,
  rotation: number,
  deltaTime: number,
): void {
  "worklet";
  rebuildProfile(
    state,
    clamp(rotation, 0, MAX_PRESSED_ROLL_TILT),
    bendAmplitudeForChord(clamp(edgeX, MIN_PRESSED_EDGE_X, 1)),
    0,
    0,
    deltaTime,
  );
}

function rebuildTurnProfile(
  state: PageTurnWorkletState,
  progress: number,
  startX: number,
  startRotation: number,
  deltaTime: number,
): void {
  "worklet";
  const safeProgress = clamp(progress, 0, 1);
  const startAmplitude = bendAmplitudeForChord(
    clamp(startX, MIN_PRESSED_EDGE_X, 1),
  );
  const rootTangent = startRotation + startAmplitude;
  const landingStart = turnLandingStart(rootTangent);
  const landing = safeProgress > landingStart;
  const landedLength = landing
    ? (safeProgress - landingStart) / (1 - landingStart)
    : 0;
  const curlRetention = turnCurlRetention(
    landedLength,
    state.tuningCurvatureRelaxation,
  );
  const bendAmplitude = startAmplitude * curlRetention;
  const swungRotation =
    landingStart > 0
      ? startRotation + (Math.PI - rootTangent) * (safeProgress / landingStart)
      : Math.PI - bendAmplitude;
  rebuildProfile(
    state,
    landing ? Math.PI - bendAmplitude : swungRotation,
    bendAmplitude,
    turnCurvatureUniformity(curlRetention),
    landedLength,
    deltaTime,
  );
}

/**
 * Kept local so the UI runtime never has to serialize a module-private helper
 * reached through an imported worklet function.
 */
function postHingeTurnProgressForFingerXWorklet(
  fingerX: number,
  startBookX: number,
  curvatureRelaxation: number,
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
      Number.isFinite(curvatureRelaxation) ? curvatureRelaxation : 7,
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

function applyDraggedProfile(
  state: PageTurnWorkletState,
  bookX: number,
  deltaTime: number,
): void {
  "worklet";
  if (state.weakGrip) {
    state.gestureFingerX = 1;
    const leftwardTravel = Math.max(0, state.startBookX - bookX);
    const compression = Math.min(
      WEAK_GRIP_MAX_COMPRESSION,
      leftwardTravel * WEAK_GRIP_COMPRESSION_PER_PAGE,
    );
    state.pressedEdgeX = 1 - compression;
    state.heldRollTilt = 0;
    state.dragTurnProgress = 0;
    rebuildPressedProfile(state, state.pressedEdgeX, 0, deltaTime);
    return;
  }

  state.gestureFingerX = clamp(1 + bookX - state.startBookX, -1, 1);
  state.heldRollTilt = gestureLiftRotationForFingerX(state.gestureFingerX);
  state.pressedEdgeX = gesturePressedChordForFingerX(
    state.gestureFingerX,
    state.heldRollTilt,
  );
  state.dragTurnProgress = postHingeTurnProgressForFingerXWorklet(
    state.gestureFingerX,
    state.startBookX,
    state.tuningCurvatureRelaxation,
  );
  if (state.dragTurnProgress > 0) {
    rebuildTurnProfile(
      state,
      state.dragTurnProgress,
      GESTURE_HINGE_CHORD_X,
      GESTURE_HINGE_ROTATION,
      deltaTime,
    );
    return;
  }
  rebuildPressedProfile(
    state,
    state.pressedEdgeX,
    state.heldRollTilt,
    deltaTime,
  );
}

function beginTurnDrive(
  state: PageTurnWorkletState,
  startX: number,
  startProgress: number,
  speedScale: number,
  startRotation: number,
): void {
  "worklet";
  state.phase = PAGE_TURN_WORKLET_TURN;
  state.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
  state.outcomeNotified = false;
  state.driveElapsed = 0;
  state.driveStartX = startX;
  state.driveSpeedScale = speedScale;
  state.driveStartProgress = startProgress;
  state.driveStartRotation = startRotation;
}

function beginSettlingDrive(
  state: PageTurnWorkletState,
  startProgress: number,
): void {
  "worklet";
  state.phase = PAGE_TURN_WORKLET_SETTLE;
  state.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
  state.outcomeNotified = false;
  state.driveElapsed = 0;
  state.driveStartX = state.tuningReleaseX;
  state.driveSpeedScale = 1;
  state.driveStartProgress = clamp(
    startProgress,
    SETTLING_PAGE_START_PROGRESS,
    1,
  );
  state.driveStartRotation = 0;
}

function beginRevertDrive(
  state: PageTurnWorkletState,
  pressedEdgeX: number,
  startRotation: number,
): void {
  "worklet";
  const safeEdgeX = clamp(pressedEdgeX, MIN_PRESSED_EDGE_X, 1);
  state.phase = PAGE_TURN_WORKLET_REVERT;
  state.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
  state.outcomeNotified = false;
  state.driveElapsed = 0;
  state.revertPressedStartX = safeEdgeX;
  state.revertCompleteness = pressedRollCompleteness(safeEdgeX);
  state.revertStartRotation = startRotation;
}

function advancePageTurnWorkletStep(
  state: PageTurnWorkletState,
  deltaTime: number,
): void {
  "worklet";
  state.driveElapsed += deltaTime;

  if (state.phase === PAGE_TURN_WORKLET_PRESS) {
    const progress = Math.min(
      1,
      state.driveElapsed / AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS,
    );
    const edgeX = 1 + (state.tuningReleaseX - 1) * progress;
    rebuildPressedProfile(state, edgeX, 0, deltaTime);
    if (progress >= 1) {
      state.phase = PAGE_TURN_WORKLET_TURN;
      state.driveElapsed = 0;
      state.driveStartX = state.tuningReleaseX;
      state.driveStartProgress = 0;
      state.driveStartRotation = 0;
    }
    return;
  }

  if (state.phase === PAGE_TURN_WORKLET_REVERT) {
    const duration = revertDuration(
      state.revertPressedStartX,
      state.revertCompleteness,
    );
    const progress = clamp(state.driveElapsed / Math.max(1e-8, duration), 0, 1);
    const easedProgress = 1 - (1 - progress) ** 3;
    const edgeX =
      state.revertPressedStartX +
      (1 - state.revertPressedStartX) * easedProgress;
    const rotation = state.revertStartRotation * (1 - easedProgress);
    rebuildPressedProfile(state, edgeX, rotation, deltaTime);
    if (state.driveElapsed >= duration) {
      setFlatProfile(state);
      state.phase = PAGE_TURN_WORKLET_IDLE;
      state.outcome = PAGE_TURN_WORKLET_REVERTED;
    }
    return;
  }

  if (state.phase === PAGE_TURN_WORKLET_SETTLE) {
    const remainingRatio =
      (1 - state.driveStartProgress) / (1 - SETTLING_PAGE_START_PROGRESS);
    const duration = Math.max(
      1 / 60,
      INCOMING_PAGE_SETTLE_DURATION_SECONDS * remainingRatio,
    );
    const segmentProgress = clamp(state.driveElapsed / duration, 0, 1);
    const easedProgress = 1 - (1 - segmentProgress) ** 2;
    const progress =
      state.driveStartProgress + (1 - state.driveStartProgress) * easedProgress;
    rebuildTurnProfile(state, progress, state.driveStartX, 0, deltaTime);
    if (state.driveElapsed >= duration) {
      rebuildTurnProfile(state, 1, state.driveStartX, 0, deltaTime);
      state.phase = PAGE_TURN_WORKLET_COMPLETED;
      state.outcome = PAGE_TURN_WORKLET_COMMITTED;
      state.meanSpeed = 0;
      state.edgeVelocityX = 0;
      state.flatteningRate = 0;
    }
    return;
  }

  if (state.phase === PAGE_TURN_WORKLET_TURN) {
    const propagationSpeed =
      state.tuningLiftVelocity *
      state.tuningLiftToLeft *
      PAGE_TURN_PROPAGATION_SPEED_SCALE *
      state.driveSpeedScale;
    const remainingRotationRatio =
      (Math.PI - state.driveStartRotation) / Math.PI;
    const fullDuration =
      ((state.driveStartX + 1) * remainingRotationRatio) /
      Math.max(0.1, propagationSpeed);
    const duration = Math.max(
      1e-6,
      (1 - state.driveStartProgress) * fullDuration,
    );
    const segmentProgress = Math.min(1, state.driveElapsed / duration);
    const progress =
      state.driveStartProgress +
      (1 - state.driveStartProgress) * segmentProgress;
    rebuildTurnProfile(
      state,
      progress,
      state.driveStartX,
      state.driveStartRotation,
      deltaTime,
    );
    if (progress >= 1) {
      state.phase = PAGE_TURN_WORKLET_COMPLETED;
      state.outcome = PAGE_TURN_WORKLET_COMMITTED;
      state.meanSpeed = 0;
      state.edgeVelocityX = 0;
      state.flatteningRate = 0;
    }
  }
}

export function resetPageTurnWorklet(state: PageTurnWorkletState): void {
  "worklet";
  state.phase = PAGE_TURN_WORKLET_IDLE;
  state.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
  state.outcomeNotified = false;
  state.settlingIncomingPage = false;
  state.dragTurnProgress = 0;
  state.settlingProgress = 0;
  state.driveElapsed = 0;
  state.meanSpeed = 0;
  setFlatProfile(state);
}

export function beginPageTurnWorkletDrag(
  state: PageTurnWorkletState,
  direction: 1 | -1,
  startBookX: number,
  startBookY: number,
  time: number,
  settlingIncomingPage: boolean,
): boolean {
  "worklet";
  resetPageTurnWorklet(state);
  state.direction = direction;
  state.settlingIncomingPage = settlingIncomingPage;
  state.phase = PAGE_TURN_WORKLET_DRAG;
  state.startBookX = startBookX;
  state.lastBookX = startBookX;
  state.lastBookY = startBookY;
  state.lastTime = safeTime(time);
  state.velocityX = 0;
  state.velocityY = 0;
  state.throwAcceleration = 0;
  state.gestureFingerX = 1;
  state.pressedEdgeX = 1;
  state.heldRollTilt = 0;
  state.weakGrip = startBookX < FULL_GESTURE_START_MIN_X;
  state.dragTurnProgress = 0;
  state.settlingProgress = 0;

  if (settlingIncomingPage) {
    rebuildTurnProfile(
      state,
      SETTLING_PAGE_START_PROGRESS,
      state.tuningReleaseX,
      0,
      0,
    );
  } else {
    applyDraggedProfile(state, startBookX, 0);
  }
  return true;
}

export function movePageTurnWorkletDrag(
  state: PageTurnWorkletState,
  bookX: number,
  bookY: number,
  turnProgress: number,
  time: number,
): boolean {
  "worklet";
  if (state.phase !== PAGE_TURN_WORKLET_DRAG) {
    return false;
  }
  const currentTime = safeTime(time);
  const deltaTime = Math.max(0.001, currentTime - state.lastTime);

  if (state.settlingIncomingPage) {
    state.lastTime = currentTime;
    state.settlingProgress = clamp(turnProgress, 0, 1);
    rebuildTurnProfile(
      state,
      landingTurnProgress(state.settlingProgress),
      state.tuningReleaseX,
      0,
      deltaTime,
    );
    return true;
  }

  const deltaX = bookX - state.lastBookX;
  const deltaY = bookY - state.lastBookY;
  const previousThrowVelocity = gestureThrowVelocity(state);
  const instantaneousVelocityX = clamp(
    deltaX / deltaTime,
    -MAX_TRACKED_GESTURE_VELOCITY,
    MAX_TRACKED_GESTURE_VELOCITY,
  );
  const instantaneousVelocityY = clamp(
    deltaY / deltaTime,
    -MAX_TRACKED_GESTURE_VELOCITY,
    MAX_TRACKED_GESTURE_VELOCITY,
  );
  const velocityBlend =
    1 - Math.exp(-deltaTime / GESTURE_VELOCITY_TIME_CONSTANT);
  state.velocityX += (instantaneousVelocityX - state.velocityX) * velocityBlend;
  state.velocityY += (instantaneousVelocityY - state.velocityY) * velocityBlend;
  const throwVelocity = gestureThrowVelocity(state);
  const instantaneousAcceleration = clamp(
    (throwVelocity - previousThrowVelocity) / deltaTime,
    -MAX_TRACKED_GESTURE_ACCELERATION,
    MAX_TRACKED_GESTURE_ACCELERATION,
  );
  const accelerationBlend =
    1 - Math.exp(-deltaTime / GESTURE_ACCELERATION_TIME_CONSTANT);
  state.throwAcceleration +=
    (instantaneousAcceleration - state.throwAcceleration) * accelerationBlend;
  state.lastBookX = bookX;
  state.lastBookY = bookY;
  state.lastTime = currentTime;
  applyDraggedProfile(state, bookX, deltaTime);
  return true;
}

export function playPageTurnWorklet(
  state: PageTurnWorkletState,
  direction: 1 | -1,
  settlingIncomingPage: boolean,
): void {
  "worklet";
  resetPageTurnWorklet(state);
  state.direction = direction;
  state.settlingIncomingPage = settlingIncomingPage;
  if (settlingIncomingPage) {
    rebuildTurnProfile(
      state,
      SETTLING_PAGE_START_PROGRESS,
      state.tuningReleaseX,
      0,
      0,
    );
    beginSettlingDrive(state, SETTLING_PAGE_START_PROGRESS);
    return;
  }
  state.phase = PAGE_TURN_WORKLET_PRESS;
  state.driveElapsed = 0;
  state.driveStartX = state.tuningReleaseX;
  state.driveStartProgress = 0;
  state.driveStartRotation = 0;
  state.driveSpeedScale = 1;
}

export function playReleasedPageTurnWorklet(
  state: PageTurnWorkletState,
  direction: 1 | -1,
  settlingIncomingPage: boolean,
  release: ReleasedPageTurnGesture,
): void {
  "worklet";
  resetPageTurnWorklet(state);
  state.direction = direction;
  state.settlingIncomingPage = settlingIncomingPage;
  if (settlingIncomingPage) {
    const startProgress = landingTurnProgress(
      Math.min(1, Math.max(0, release.settlingProgress)),
    );
    rebuildTurnProfile(state, startProgress, state.tuningReleaseX, 0, 0);
    beginSettlingDrive(state, startProgress);
    return;
  }

  const startX = Math.min(
    1,
    Math.max(MIN_PRESSED_EDGE_X, release.pressedEdgeX),
  );
  const startRotation = Math.min(
    MAX_PRESSED_ROLL_TILT,
    Math.max(0, release.heldRollTilt),
  );
  const startProgress = Math.min(1, Math.max(0, release.turnProgress));
  state.gestureFingerX = startX;
  state.pressedEdgeX = startX;
  state.heldRollTilt = startRotation;
  state.dragTurnProgress = startProgress;
  rebuildTurnProfile(state, startProgress, startX, startRotation, 0);
  beginTurnDrive(
    state,
    startX,
    startProgress,
    Math.min(3, Math.max(0.5, release.speedScale)),
    startRotation,
  );
}

export function endPageTurnWorkletDrag(
  state: PageTurnWorkletState,
  time: number,
): number {
  "worklet";
  if (state.phase !== PAGE_TURN_WORKLET_DRAG) {
    return PAGE_TURN_WORKLET_NO_OUTCOME;
  }

  if (state.settlingIncomingPage) {
    beginSettlingDrive(state, landingTurnProgress(state.settlingProgress));
    return PAGE_TURN_WORKLET_COMMITTED;
  }

  const currentTime = safeTime(time);
  const idleTime = Math.max(0, currentTime - state.lastTime);
  const idleDecay = Math.exp(-idleTime / state.tuningGestureIdleDecaySeconds);
  const throwVelocity = gestureThrowVelocity(state) * idleDecay;
  const throwAcceleration = state.throwAcceleration * idleDecay;
  if (state.weakGrip) {
    beginRevertDrive(state, state.pressedEdgeX, 0);
    return PAGE_TURN_WORKLET_REVERTED;
  }

  const distance = clamp(
    (1 - state.gestureFingerX) / (1 - slowCommitEdgeX()),
    0,
    1.2,
  );
  const velocity =
    clamp(throwVelocity, 0, COMMIT_VELOCITY_LIMIT) * COMMIT_VELOCITY_GAIN;
  const acceleration =
    clamp(throwAcceleration, 0, COMMIT_ACCELERATION_LIMIT) *
    COMMIT_ACCELERATION_GAIN;
  const score =
    (distance + velocity + acceleration) /
    clamp(state.tuningPageWeight, MIN_PAGE_WEIGHT, MAX_PAGE_WEIGHT);
  if (score >= state.tuningGestureCommitThreshold - 1e-6) {
    beginTurnDrive(
      state,
      state.pressedEdgeX,
      state.dragTurnProgress,
      gestureTurnSpeedScale(state, throwVelocity),
      state.heldRollTilt,
    );
    return PAGE_TURN_WORKLET_COMMITTED;
  }
  beginRevertDrive(state, state.pressedEdgeX, state.heldRollTilt);
  return PAGE_TURN_WORKLET_REVERTED;
}

export function cancelPageTurnWorkletDrag(state: PageTurnWorkletState): void {
  "worklet";
  resetPageTurnWorklet(state);
  state.outcome = PAGE_TURN_WORKLET_REVERTED;
}

export function advancePageTurnWorklet(
  state: PageTurnWorkletState,
  deltaTime: number,
): boolean {
  "worklet";
  let remainingTime = clamp(deltaTime, 0, 0.25);
  let advanced = false;
  while (
    remainingTime > 0 &&
    state.phase !== PAGE_TURN_WORKLET_IDLE &&
    state.phase !== PAGE_TURN_WORKLET_DRAG &&
    state.phase !== PAGE_TURN_WORKLET_COMPLETED
  ) {
    const step = Math.min(0.05, remainingTime);
    advancePageTurnWorkletStep(state, step);
    remainingTime -= step;
    advanced = true;
  }
  return advanced;
}

export function catchUpPageTurnWorklet(
  state: PageTurnWorkletState,
  elapsedSeconds: number,
): boolean {
  "worklet";
  let remainingTime = Number.isFinite(elapsedSeconds)
    ? Math.min(1, Math.max(0, elapsedSeconds))
    : 0;
  let advanced = false;
  while (remainingTime > 0) {
    const step = Math.min(0.25, remainingTime);
    if (!advancePageTurnWorklet(state, step)) {
      break;
    }
    remainingTime -= step;
    advanced = true;
  }
  return advanced;
}
