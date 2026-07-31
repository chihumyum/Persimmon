const MINIMUM_SHADOW_WIDTH = 0.045;
const MAXIMUM_SHADOW_WIDTH = 0.28;
const MAXIMUM_SHADOW_STRENGTH = 0.34;
const MAXIMUM_CURVATURE = 2.147033481101353;

// Keep worklet dependencies above the worklet that captures them. The native
// Worklets compiler serializes module-local helpers in source order.
function clamp(value: number, minimum: number, maximum: number): number {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  "worklet";
  const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

/**
 * Writes the shadow shader input without allocating in the render loop.
 *
 * Positions and velocities are projected into book coordinates before they
 * arrive here. Multiplying by direction then expresses motion relative to the
 * source page: positive is still on that page, positive velocity is the brief
 * outward push produced while a tight roll is flattening.
 */
export function updateDynamicPageTurnShadow(
  shadow: number[],
  minimumX: number,
  maximumX: number,
  projectedEdgeX: number,
  projectedEdgeVelocityX: number,
  curvature: number,
  flatteningRate: number,
  maxLift: number,
  meanSpeed: number,
  direction: 1 | -1,
  completed: boolean,
): void {
  "worklet";
  const sourceEdgeX = projectedEdgeX * direction;
  const sourceEdgeVelocityX = projectedEdgeVelocityX * direction;
  const sourceSilhouette = direction === 1 ? maximumX : minimumX;
  const curl = clamp(curvature / MAXIMUM_CURVATURE, 0, 1);
  const flattening = 1 - Math.exp(-Math.max(0, flatteningRate) / 8);
  const outwardPush = 1 - Math.exp(-Math.max(0, sourceEdgeVelocityX) / 1.8);
  const leftwardSpeed = Math.max(0, -sourceEdgeVelocityX);

  // Keep the shadow while the material edge is on the source page, then make
  // it disappear within 0.035 page widths after crossing the spine.
  const edgePresence = smoothstep(-0.035, 0.1, sourceEdgeX);
  const leftwardFade = 1 / (1 + leftwardSpeed * 0.14);
  const flatteningCompression = curl * flattening * (0.62 + outwardPush * 0.38);

  const baseStrength =
    0.018 + maxLift * 0.28 + meanSpeed * 0.011 + flatteningCompression * 0.12;
  const strength = completed
    ? 0
    : clamp(
        baseStrength * edgePresence * leftwardFade,
        0,
        MAXIMUM_SHADOW_STRENGTH,
      );

  shadow[0] = sourceSilhouette;
  shadow[1] = clamp(
    MINIMUM_SHADOW_WIDTH +
      maxLift * 0.12 +
      curl * 0.035 +
      flatteningCompression * 0.045,
    MINIMUM_SHADOW_WIDTH,
    MAXIMUM_SHADOW_WIDTH,
  );
  shadow[2] = strength < 0.0005 ? 0 : strength;
  shadow[3] = direction;
}
