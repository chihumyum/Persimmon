import {
  DEFAULT_PAGE_TURN_TUNING,
  postHingeTurnProgressForFingerX,
  type ReleasedPageTurnGesture,
  type PageTurnTuning,
} from "./page-turn-gesture";
import {
  DEFAULT_PAGE_PROFILE_POINTS,
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  TURN_UNROLL_START,
  gestureTurnUnrollStart,
  turnBendRetention,
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
const SUBSTEPS_PER_PROFILE_SEGMENT = 8;
const PROFILE_BEND_AMPLITUDE_SLICES = 257;
const MAX_PROFILE_BEND_AMPLITUDE = 2.3382951135873746;
const SETTLING_PAGE_START_PROGRESS = 0.5;
const GESTURE_VELOCITY_TIME_CONSTANT = 0.045;
const GESTURE_ACCELERATION_TIME_CONSTANT = 0.06;
const MAX_TRACKED_GESTURE_VELOCITY = 6;
const MAX_TRACKED_GESTURE_ACCELERATION = 20;
const FULL_GESTURE_START_MIN_X = 2 / 3;
const WEAK_GRIP_MAX_COMPRESSION = 0.04;
const WEAK_GRIP_COMPRESSION_PER_PAGE = 0.2;
const MIN_PAGE_WEIGHT = 0.5;
const MAX_PAGE_WEIGHT = 1.8;
const COMMIT_VELOCITY_LIMIT = 3.2;
const COMMIT_ACCELERATION_LIMIT = 10;
const COMMIT_VELOCITY_GAIN = 0.18;
const COMMIT_ACCELERATION_GAIN = 0.035;
const MIN_REVERT_INITIAL_SPEED = 0.65;
const MAX_REVERT_INITIAL_SPEED = 6.3;
const REVERT_EASE_OUT_INITIAL_SLOPE = 3;

// Inverse J0 on the page's supported chord interval [0.035, 1].
// This degree-10 Chebyshev approximation has < 9e-8 radians maximum error
// against the old 48 x 256 bisection/integration solver. It removes more than
// twelve thousand cosine evaluations from every drag update.
const INVERSE_BESSEL_CHEBYSHEV = [
  2.1667709839070377, -0.18629174453685354, 0.02265270180455248,
  -0.0037165828681793253, 0.0007038952663799921, -0.00014500246546194032,
  0.000031566578791633, -0.000007135535298704449, 0.0000016623788064225635,
  -0.0000003841457726910674, 0.00000009309814723863693,
] as const;

// Stable geometry of the fully compressed reference hinge.
const PRESSED_HINGE_TILT_DISTANCE = 0.27513626075612096;
const GESTURE_LIFT_START_X = 0.5;
const SLOW_COMMIT_EDGE_X = MIN_PRESSED_EDGE_X - PRESSED_HINGE_TILT_DISTANCE;

/**
 * The elastica's unrotated shape depends only on bend amplitude. Build that
 * two-dimensional table once when the module loads, then interpolate it in
 * the UI worklet. At 257 amplitude slices the maximum position error against
 * the original 8-substep integration is below 5.3e-6 page widths (about
 * 0.007 physical pixels on a 402-point, 3x display).
 *
 * This removes 512 sin/cos pairs from every pointer/display frame without
 * reducing the rendered 65-point spatial profile or quantizing touch input.
 */
const PROFILE_BEND_LOOKUP = createProfileBendLookup();

function createProfileBendLookup(): Float32Array {
  const valuesPerSlice = DEFAULT_PAGE_PROFILE_POINTS * 2;
  const lookup = new Float32Array(
    PROFILE_BEND_AMPLITUDE_SLICES * valuesPerSlice,
  );
  const segmentLength = 1 / (DEFAULT_PAGE_PROFILE_POINTS - 1);
  const substepLength = segmentLength / SUBSTEPS_PER_PROFILE_SEGMENT;
  for (let slice = 0; slice < PROFILE_BEND_AMPLITUDE_SLICES; slice += 1) {
    const bendAmplitude =
      (slice / (PROFILE_BEND_AMPLITUDE_SLICES - 1)) *
      MAX_PROFILE_BEND_AMPLITUDE;
    const sliceOffset = slice * valuesPerSlice;
    let x = 0;
    let z = 0;
    for (
      let segment = 0;
      segment < DEFAULT_PAGE_PROFILE_POINTS - 1;
      segment += 1
    ) {
      for (
        let substep = 0;
        substep < SUBSTEPS_PER_PROFILE_SEGMENT;
        substep += 1
      ) {
        const material =
          (segment + (substep + 0.5) / SUBSTEPS_PER_PROFILE_SEGMENT) /
          (DEFAULT_PAGE_PROFILE_POINTS - 1);
        const angle = bendAmplitude * Math.cos(Math.PI * material);
        x += Math.cos(angle) * substepLength;
        z += Math.sin(angle) * substepLength;
      }
      const pointOffset = sliceOffset + (segment + 1) * 2;
      lookup[pointOffset] = x;
      lookup[pointOffset + 1] = z;
    }
  }
  return lookup;
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
  driveUnrollStart: number;
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
      0.4,
      1.2,
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
    driveUnrollStart: TURN_UNROLL_START,
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
    1.2,
    Math.max(0.4, tuning.gestureCommitThreshold),
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
    (2 * (safeChord - MIN_PRESSED_EDGE_X)) / (1 - MIN_PRESSED_EDGE_X) - 1;
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
  const progress = clamp(
    (GESTURE_LIFT_START_X - fingerX) /
      (GESTURE_LIFT_START_X - SLOW_COMMIT_EDGE_X),
    0,
    1,
  );
  const easedProgress = 1 - (1 - progress) ** 2;
  return MAX_PRESSED_ROLL_TILT * easedProgress;
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

function rebuildProfile(
  state: PageTurnWorkletState,
  rotation: number,
  bendAmplitude: number,
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
  const amplitudePosition =
    (clamp(bendAmplitude, 0, MAX_PROFILE_BEND_AMPLITUDE) /
      MAX_PROFILE_BEND_AMPLITUDE) *
    (PROFILE_BEND_AMPLITUDE_SLICES - 1);
  const beforeSlice = Math.min(
    PROFILE_BEND_AMPLITUDE_SLICES - 2,
    Math.floor(amplitudePosition),
  );
  const afterSlice = beforeSlice + 1;
  const amplitudeMix = amplitudePosition - beforeSlice;
  const valuesPerSlice = DEFAULT_PAGE_PROFILE_POINTS * 2;
  const beforeSliceOffset = beforeSlice * valuesPerSlice;
  const afterSliceOffset = afterSlice * valuesPerSlice;
  const rotationCosine = Math.cos(rotation);
  const rotationSine = Math.sin(rotation);
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const lookupOffset = index * 2;
    const baseX =
      PROFILE_BEND_LOOKUP[beforeSliceOffset + lookupOffset]! +
      (PROFILE_BEND_LOOKUP[afterSliceOffset + lookupOffset]! -
        PROFILE_BEND_LOOKUP[beforeSliceOffset + lookupOffset]!) *
        amplitudeMix;
    const baseZ =
      PROFILE_BEND_LOOKUP[beforeSliceOffset + lookupOffset + 1]! +
      (PROFILE_BEND_LOOKUP[afterSliceOffset + lookupOffset + 1]! -
        PROFILE_BEND_LOOKUP[beforeSliceOffset + lookupOffset + 1]!) *
        amplitudeMix;
    const x = baseX * rotationCosine - baseZ * rotationSine;
    const z = baseX * rotationSine + baseZ * rotationCosine;
    const offset = index * PROFILE_FLOATS_PER_POINT;
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
    deltaTime,
  );
}

function rebuildTurnProfile(
  state: PageTurnWorkletState,
  progress: number,
  startX: number,
  startRotation: number,
  deltaTime: number,
  unrollStart = TURN_UNROLL_START,
): void {
  "worklet";
  const safeProgress = clamp(progress, 0, 1);
  rebuildProfile(
    state,
    startRotation + (Math.PI - startRotation) * safeProgress,
    bendAmplitudeForChord(clamp(startX, MIN_PRESSED_EDGE_X, 1)) *
      turnBendRetention(
        safeProgress,
        state.tuningCurvatureRelaxation,
        unrollStart,
      ),
    deltaTime,
  );
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
  state.pressedEdgeX = Math.max(MIN_PRESSED_EDGE_X, state.gestureFingerX);
  state.heldRollTilt = gestureLiftRotationForFingerX(state.gestureFingerX);
  state.dragTurnProgress = postHingeTurnProgressForFingerX(
    state.gestureFingerX,
    state.startBookX,
  );
  if (state.dragTurnProgress > 0) {
    rebuildTurnProfile(
      state,
      state.dragTurnProgress,
      MIN_PRESSED_EDGE_X,
      MAX_PRESSED_ROLL_TILT,
      deltaTime,
      gestureTurnUnrollStart(MAX_PRESSED_ROLL_TILT),
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
  unrollStart = TURN_UNROLL_START,
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
  state.driveUnrollStart = unrollStart;
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
      state.driveUnrollStart = TURN_UNROLL_START;
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
      state.driveUnrollStart,
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
  state.driveUnrollStart = TURN_UNROLL_START;
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
  rebuildTurnProfile(
    state,
    startProgress,
    startX,
    startRotation,
    0,
    gestureTurnUnrollStart(startRotation),
  );
  beginTurnDrive(
    state,
    startX,
    startProgress,
    Math.min(3, Math.max(0.5, release.speedScale)),
    startRotation,
    gestureTurnUnrollStart(startRotation),
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
      gestureTurnUnrollStart(state.heldRollTilt),
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
