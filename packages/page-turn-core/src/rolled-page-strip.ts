export const DEFAULT_PAGE_PROFILE_POINTS = 65;
export const TURN_VALIDATION_FRAME_COUNT = 49;
export const MIN_PRESSED_EDGE_X = 0.14;

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
  curvatureUniformity: number;
  landedLength: number;
}

const ROOT_INTEGRATION_STEPS = 256;
/** Two-point Gauss-Legendre node offset, in fractions of a segment. */
export const PROFILE_QUADRATURE_OFFSET = 0.5 / Math.sqrt(3);
const FIRST_BESSEL_ZERO = 2.4048255577;
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
 * Splits a turn into the swing that carries the roll onto the landing page and
 * the roll-out that lays the paper down.
 *
 * A turn cannot deposit paper before the sheet leaves the spine along the
 * landing page, so the swing has to finish first. Its share is the angle still
 * to be swung, measured against the page length the roll-out has to cover. A
 * roll that is already tangent to the landing page - what the two-page gesture
 * hands over at the hinge - starts laying paper down immediately.
 */
export function turnLandingStart(rootTangent: number): number {
  "worklet";
  const swing = Math.min(1, Math.max(0, (Math.PI - rootTangent) / Math.PI));
  return swing / (swing + 1);
}

/**
 * Deterministic, inextensible page strip.
 *
 * The paper that has already landed lies flat along the landing page. The rest
 * carries the curl: theta = rotation + bendAmplitude * curlMode(t, uniformity),
 * where t runs across the material that has not landed yet. At uniformity 0 the
 * mode is the pinned Euler-elastica bow, cos(pi * t), which is the shape of a
 * sheet pinched between the spine and a finger. At uniformity 1 it is the
 * straight ramp 1 - 2 * t, whose curvature is constant: a cylinder of radius
 * 1 / (2 * bendAmplitude).
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
        curvatureUniformity: 0,
        landedLength: 0,
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
    const quadratureOffset = segmentLength * PROFILE_QUADRATURE_OFFSET;
    const quadratureWeight = segmentLength * 0.5;
    for (let segment = 0; segment < this.points.length - 1; segment += 1) {
      const center = (segment + 0.5) * segmentLength;
      const firstAngle = tangentAngle(center - quadratureOffset, parameters);
      const secondAngle = tangentAngle(center + quadratureOffset, parameters);
      x += (Math.cos(firstAngle) + Math.cos(secondAngle)) * quadratureWeight;
      z += (Math.sin(firstAngle) + Math.sin(secondAngle)) * quadratureWeight;
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
    { rotation: 0, bendAmplitude, curvatureUniformity: 0, landedLength: 0 },
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

/**
 * A turn in two acts, both anchored to the paper below.
 *
 * The roll first swings about the spine until the sheet leaves the binding
 * along the landing page. From then on that tangent is pinned, and the turn
 * advances by laying paper down: the landed length grows toward the free edge
 * while the roll rides on the contact point and gives up its curl. Pinning the
 * tangent is what keeps the sheet out of the page it is landing on, and laying
 * paper down is what makes the contact travel instead of the whole sheet
 * dropping flat at once.
 */
function turnParameters(
  progress: number,
  startAmplitude: number,
  startRotation: number,
  curvatureRelaxation: number,
): ProfileParameters {
  const rootTangent = startRotation + startAmplitude;
  const landingStart = turnLandingStart(rootTangent);
  const landing = progress > landingStart;
  const landedLength = landing
    ? (progress - landingStart) / (1 - landingStart)
    : 0;
  const curlRetention = turnCurlRetention(landedLength, curvatureRelaxation);
  const bendAmplitude = startAmplitude * curlRetention;
  // Rotation is written as an offset from the start pose rather than
  // "tangent - amplitude" so that progress 0 reproduces the held roll exactly.
  const swungRotation =
    landingStart > 0
      ? startRotation + (Math.PI - rootTangent) * (progress / landingStart)
      : Math.PI - bendAmplitude;
  return {
    rotation: landing ? Math.PI - bendAmplitude : swungRotation,
    bendAmplitude,
    curvatureUniformity: turnCurvatureUniformity(curlRetention),
    landedLength,
  };
}

/**
 * How much of its turn the roll still holds after part of the sheet has landed.
 *
 * Paper leaving the roll shortens it, so a roll that kept its turn angle would
 * wind tighter as it rolled - the opposite of paper relaxing. Giving up turn
 * faster than material makes the radius grow the whole way out, to a straight
 * sheet at the end. The relaxation control sets how much faster.
 */
export function turnCurlRetention(
  landedLength: number,
  curvatureRelaxation: number,
): number {
  "worklet";
  const remaining = Math.min(1, Math.max(0, 1 - landedLength));
  const relaxation = Math.min(14, Math.max(3.5, curvatureRelaxation));
  return remaining ** (1 + relaxation / 14);
}

/**
 * Spreads the retained curl evenly along the sheet as it unrolls.
 *
 * While the finger pinches the page, both ends are moment-free, so the bend
 * concentrates mid-sheet: two nearly flat halves meeting in a crease. Once the
 * roll is released that constraint is gone, and bending moment diffuses toward
 * a constant along a free strip, which is a cylinder. Tying the uniformity to
 * the curl the sheet still holds runs both parts of the relaxation off one
 * clock: the crease spreads out while the roll is still visibly round, so the
 * page opens as a cylinder of growing radius instead of a hinge widening from
 * an acute angle to a flat sheet.
 */
export function turnCurvatureUniformity(bendRetention: number): number {
  "worklet";
  const retained = Math.min(1, Math.max(0, bendRetention));
  return 1 - retained * retained * retained;
}

/**
 * Paper that has landed lies along the landing page; the rest carries the curl
 * over the material it has left.
 */
function tangentAngle(material: number, parameters: ProfileParameters): number {
  const landed = parameters.landedLength;
  const airborne = 1 - landed;
  if (landed > 0 && (material <= landed || airborne <= 1e-9)) {
    return Math.PI;
  }
  return (
    parameters.rotation +
    parameters.bendAmplitude *
      curlMode(
        landed > 0 ? (material - landed) / airborne : material,
        parameters.curvatureUniformity,
      )
  );
}

/**
 * Blends the pinned elastica mode into constant curvature. Both ends of the
 * blend leave the sheet the same total turn and the same end tangents, so only
 * the distribution of the bend along the paper changes.
 */
function curlMode(material: number, curvatureUniformity: number): number {
  const pinned = Math.cos(Math.PI * material);
  const uniform = 1 - 2 * material;
  return pinned + curvatureUniformity * (uniform - pinned);
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
