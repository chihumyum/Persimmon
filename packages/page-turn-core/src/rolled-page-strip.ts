export const DEFAULT_PAGE_PROFILE_POINTS = 65;
export const TURN_VALIDATION_FRAME_COUNT = 49;
export const MIN_PRESSED_EDGE_X = 0.035;

export interface RolledPagePoint {
  x: number;
  z: number;
}

export interface RolledPageMetrics {
  arcLength: number;
  edgeX: number;
  edgeZ: number;
  edgeVelocityX: number;
  curvature: number;
  flatteningRate: number;
  maxLift: number;
  meanSpeed: number;
}

export interface PressedRollHingeGeometry {
  readonly apexX: number;
  readonly apexZ: number;
  readonly maxTilt: number;
  readonly tiltDistance: number;
}

interface ProfileParameters {
  rotation: number;
  bendAmplitude: number;
}

const ROOT_INTEGRATION_STEPS = 256;
const SUBSTEPS_PER_PROFILE_SEGMENT = 8;
const FIRST_BESSEL_ZERO = 2.4048255577;
export const TURN_UNROLL_START = 0.08;
export const MAX_TURN_UNROLL_START = 0.5;
export const DEFAULT_CURVATURE_RELAXATION = 7;
const PRESSED_SURFACE_CLEARANCE = 0.015;
export const MAX_PRESSED_ROLL_TILT = Math.max(
  0,
  Math.PI -
    bendAmplitudeForChord(MIN_PRESSED_EDGE_X) -
    PRESSED_SURFACE_CLEARANCE,
);
const PRESSED_ROLL_APEX_MATERIAL = 0.5;
let cachedPressedRollHingeGeometry: PressedRollHingeGeometry | null = null;

/**
 * A hand-held roll must pass the vertical point before its chord expands.
 * Unrolling earlier makes the free edge move backward briefly even though the
 * finger and turn progress are still moving toward the landing side.
 */
export function gestureTurnUnrollStart(startRotation: number): number {
  "worklet";
  const rotation = clamp(startRotation, 0, MAX_PRESSED_ROLL_TILT);
  return clamp(
    (Math.PI * 0.5 - rotation) / (Math.PI - rotation),
    TURN_UNROLL_START,
    MAX_TURN_UNROLL_START,
  );
}

/**
 * Deterministic, inextensible page strip driven by a symmetric Euler-elastica
 * mode: theta(s) = rotation + bendAmplitude * cos(pi * s).
 */
export class RolledPageStrip {
  private readonly points: RolledPagePoint[];
  private readonly previousX: Float64Array;
  private readonly previousZ: Float64Array;
  private metrics: RolledPageMetrics;
  private cachedTurnStartX = -1;
  private cachedTurnAmplitude = 0;
  private previousCurvature = 0;

  constructor(pointCount = DEFAULT_PAGE_PROFILE_POINTS) {
    if (!Number.isInteger(pointCount) || pointCount < 3) {
      throw new Error("A page profile needs at least three sample points.");
    }
    this.points = Array.from({ length: pointCount }, (_, index) => ({
      x: index / (pointCount - 1),
      z: 0,
    }));
    this.previousX = new Float64Array(pointCount);
    this.previousZ = new Float64Array(pointCount);
    this.metrics = flatMetrics();
  }

  reset(): void {
    for (let index = 0; index < this.points.length; index += 1) {
      this.points[index].x = index / (this.points.length - 1);
      this.points[index].z = 0;
    }
    this.metrics = flatMetrics();
    this.previousCurvature = 0;
  }

  setPressedEdge(edgeX: number, deltaTime = 0): void {
    this.setPressedState(edgeX, 0, deltaTime);
  }

  setPressedState(edgeX: number, rotation: number, deltaTime = 0): void {
    const safeEdgeX = clamp(edgeX, MIN_PRESSED_EDGE_X, 1);
    this.rebuild(
      {
        rotation: clamp(rotation, 0, MAX_PRESSED_ROLL_TILT),
        bendAmplitude: bendAmplitudeForChord(safeEdgeX),
      },
      deltaTime,
    );
  }

  setTurnProgress(
    progress: number,
    startX: number,
    deltaTime = 0,
    startRotation = 0,
    curvatureRelaxation = DEFAULT_CURVATURE_RELAXATION,
    unrollStart = TURN_UNROLL_START,
  ): void {
    const safeStartX = clamp(startX, MIN_PRESSED_EDGE_X, 1);
    if (Math.abs(safeStartX - this.cachedTurnStartX) > 1e-7) {
      this.cachedTurnStartX = safeStartX;
      this.cachedTurnAmplitude = bendAmplitudeForChord(safeStartX);
    }
    this.rebuild(
      turnParameters(
        clamp(progress, 0, 1),
        this.cachedTurnAmplitude,
        clamp(startRotation, 0, MAX_PRESSED_ROLL_TILT),
        clamp(curvatureRelaxation, 3.5, 14),
        clamp(unrollStart, TURN_UNROLL_START, MAX_TURN_UNROLL_START),
      ),
      deltaTime,
    );
  }

  stop(): void {
    this.metrics = {
      ...this.metrics,
      edgeVelocityX: 0,
      flatteningRate: 0,
      meanSpeed: 0,
    };
  }

  getPoints(): readonly RolledPagePoint[] {
    return this.points;
  }

  getMetrics(): RolledPageMetrics {
    return { ...this.metrics };
  }

  private rebuild(parameters: ProfileParameters, deltaTime: number): void {
    for (let index = 0; index < this.points.length; index += 1) {
      this.previousX[index] = this.points[index].x;
      this.previousZ[index] = this.points[index].z;
    }
    let x = 0;
    let z = 0;
    let maxLift = 0;
    this.points[0].x = 0;
    this.points[0].z = 0;

    const segmentLength = 1 / (this.points.length - 1);
    const substepLength = segmentLength / SUBSTEPS_PER_PROFILE_SEGMENT;
    for (let segment = 0; segment < this.points.length - 1; segment += 1) {
      for (
        let substep = 0;
        substep < SUBSTEPS_PER_PROFILE_SEGMENT;
        substep += 1
      ) {
        const material =
          (segment + (substep + 0.5) / SUBSTEPS_PER_PROFILE_SEGMENT) /
          (this.points.length - 1);
        const angle = tangentAngle(material, parameters);
        x += Math.cos(angle) * substepLength;
        z += Math.sin(angle) * substepLength;
      }
      this.points[segment + 1].x = x;
      this.points[segment + 1].z = Math.abs(z) < 1e-10 ? 0 : z;
      maxLift = Math.max(maxLift, z);
    }

    let speedSum = 0;
    if (deltaTime > 0) {
      for (let index = 0; index < this.points.length; index += 1) {
        speedSum +=
          Math.hypot(
            this.points[index].x - this.previousX[index]!,
            this.points[index].z - this.previousZ[index]!,
          ) / deltaTime;
      }
    }

    const edge = this.points[this.points.length - 1]!;
    const curvature = Math.abs(parameters.bendAmplitude);
    const edgeVelocityX =
      deltaTime > 0
        ? (edge.x - this.previousX[this.points.length - 1]!) / deltaTime
        : 0;
    const flatteningRate =
      deltaTime > 0
        ? Math.max(0, (this.previousCurvature - curvature) / deltaTime)
        : 0;
    this.metrics = {
      arcLength: 1,
      edgeX: edge.x,
      edgeZ: edge.z,
      edgeVelocityX,
      curvature,
      flatteningRate,
      maxLift,
      meanSpeed: deltaTime > 0 ? speedSum / this.points.length : 0,
    };
    this.previousCurvature = curvature;
  }
}

export function pressedRollCompleteness(edgeX: number): number {
  const safeEdgeX = clamp(edgeX, MIN_PRESSED_EDGE_X, 1);
  if (safeEdgeX >= 0.999999) {
    return 0;
  }
  const maximumAmplitude = bendAmplitudeForChord(MIN_PRESSED_EDGE_X);
  return clamp(bendAmplitudeForChord(safeEdgeX) / maximumAmplitude, 0, 1);
}

export function pressedRollHingeGeometry(): PressedRollHingeGeometry {
  if (cachedPressedRollHingeGeometry) {
    return cachedPressedRollHingeGeometry;
  }
  const bendAmplitude = bendAmplitudeForChord(MIN_PRESSED_EDGE_X);
  const apex = integrateProfilePoint(
    PRESSED_ROLL_APEX_MATERIAL,
    { rotation: 0, bendAmplitude },
    ROOT_INTEGRATION_STEPS,
  );
  const tiltedApexX =
    apex.x * Math.cos(MAX_PRESSED_ROLL_TILT) -
    apex.z * Math.sin(MAX_PRESSED_ROLL_TILT);
  cachedPressedRollHingeGeometry = Object.freeze({
    apexX: apex.x,
    apexZ: apex.z,
    maxTilt: MAX_PRESSED_ROLL_TILT,
    tiltDistance: apex.x - tiltedApexX,
  });
  return cachedPressedRollHingeGeometry;
}

function turnParameters(
  progress: number,
  startAmplitude: number,
  startRotation: number,
  curvatureRelaxation: number,
  unrollStart: number,
): ProfileParameters {
  return {
    rotation: startRotation + (Math.PI - startRotation) * progress,
    bendAmplitude:
      startAmplitude *
      turnBendRetention(progress, curvatureRelaxation, unrollStart),
  };
}

/**
 * Keeps a visible roll into the latter half of a turn, then unfolds it with
 * zero slope at both ends. The relaxation control changes when that transition
 * happens without reintroducing the old exponential snap-to-flat.
 */
export function turnBendRetention(
  progress: number,
  curvatureRelaxation: number,
  unrollStart = TURN_UNROLL_START,
): number {
  "worklet";
  const safeProgress = Math.min(1, Math.max(0, progress));
  const unrollProgress = Math.min(
    1,
    Math.max(0, (safeProgress - unrollStart) / (1 - unrollStart)),
  );
  const safeRelaxation = Math.min(14, Math.max(3.5, curvatureRelaxation));
  const timingPower = DEFAULT_CURVATURE_RELAXATION / safeRelaxation;
  const shapedProgress = unrollProgress ** timingPower;
  const smoothProgress =
    shapedProgress *
    shapedProgress *
    shapedProgress *
    (shapedProgress * (shapedProgress * 6 - 15) + 10);
  return 1 - smoothProgress;
}

function tangentAngle(material: number, parameters: ProfileParameters): number {
  return (
    parameters.rotation +
    parameters.bendAmplitude * Math.cos(Math.PI * material)
  );
}

function integrateProfilePoint(
  materialEnd: number,
  parameters: ProfileParameters,
  steps: number,
): RolledPagePoint {
  const stepLength = materialEnd / steps;
  let x = 0;
  let z = 0;
  for (let index = 0; index < steps; index += 1) {
    const material = (index + 0.5) * stepLength;
    const angle = tangentAngle(material, parameters);
    x += Math.cos(angle) * stepLength;
    z += Math.sin(angle) * stepLength;
  }
  return { x, z };
}

function bendAmplitudeForChord(chord: number): number {
  if (chord >= 0.999999) {
    return 0;
  }
  let lower = 0;
  let upper = FIRST_BESSEL_ZERO;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (lower + upper) * 0.5;
    if (symmetricElasticaChord(middle) > chord) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return (lower + upper) * 0.5;
}

function symmetricElasticaChord(amplitude: number): number {
  let x = 0;
  for (let index = 0; index < ROOT_INTEGRATION_STEPS; index += 1) {
    const material = (index + 0.5) / ROOT_INTEGRATION_STEPS;
    x +=
      Math.cos(amplitude * Math.cos(Math.PI * material)) /
      ROOT_INTEGRATION_STEPS;
  }
  return x;
}

function clamp(value: number, minimum: number, maximum: number): number {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}

function flatMetrics(): RolledPageMetrics {
  return {
    arcLength: 1,
    edgeX: 1,
    edgeZ: 0,
    edgeVelocityX: 0,
    curvature: 0,
    flatteningRate: 0,
    maxLift: 0,
    meanSpeed: 0,
  };
}
