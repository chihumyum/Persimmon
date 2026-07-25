import {
  DEFAULT_PAGE_PROFILE_POINTS,
  type RolledPageMetrics,
  type RolledPagePoint,
} from "@persimmon/page-turn-core";

import {
  pageTurnCameraBookXForLayout,
  projectPageTurnBookX,
} from "./page-turn-perspective";
import { updateDynamicPageTurnShadow } from "./page-turn-shadow-physics";

const PROFILE_FLOATS_PER_POINT = 4;

export const NATURAL_PAGE_SHADOW_SHADER = `
uniform float2 pageSize;
uniform float4 geometry;
uniform float4 shadow;

half4 main(float2 position) {
  float bookX = (position.x - geometry.x) / geometry.y;
  float distanceFromRoll =
    (bookX - shadow.x) / max(0.035, shadow.y);
  float castShadow =
    exp(-distanceFromRoll * distanceFromRoll * 2.4) * shadow.z;
  float spineShadow =
    exp(-abs(bookX) * 44.0) * min(0.07, shadow.z * 0.32);
  float sourceSide = smoothstep(-0.02, 0.035, bookX * shadow.w);
  return half4(
    0.0,
    0.0,
    0.0,
    clamp((castShadow + spineShadow) * sourceSide, 0.0, 0.42)
  );
}
`;

export function packPageTurnProfile(
  points: readonly RolledPagePoint[],
  xScale: 1 | -1 = 1,
): number[] {
  if (points.length !== DEFAULT_PAGE_PROFILE_POINTS) {
    throw new RangeError(
      `page profile needs ${DEFAULT_PAGE_PROFILE_POINTS} points`,
    );
  }
  const packed = new Array<number>(
    DEFAULT_PAGE_PROFILE_POINTS * PROFILE_FLOATS_PER_POINT,
  );
  let offset = 0;
  for (let index = 0; index < points.length; index += 1) {
    const before = points[Math.max(0, index - 1)]!;
    const point = points[index]!;
    const after = points[Math.min(points.length - 1, index + 1)]!;
    const tangentX = after.x - before.x;
    const tangentZ = after.z - before.z;
    const tangentLength = Math.max(1e-7, Math.hypot(tangentX, tangentZ));
    packed[offset++] = point.x * xScale;
    packed[offset++] = Math.max(0, point.z);
    packed[offset++] = (-tangentZ / tangentLength) * xScale;
    packed[offset++] = tangentX / tangentLength;
  }
  return packed;
}

export function mirrorPageTurnProfile(profile: readonly number[]): number[] {
  const mirrored = new Array<number>(profile.length);
  for (
    let offset = 0;
    offset < profile.length;
    offset += PROFILE_FLOATS_PER_POINT
  ) {
    mirrored[offset] = 1 - profile[offset]!;
    mirrored[offset + 1] = profile[offset + 1]!;
    mirrored[offset + 2] = -profile[offset + 2]!;
    mirrored[offset + 3] = profile[offset + 3]!;
  }
  return mirrored;
}

export interface PageTurnShadow {
  readonly center: number;
  readonly width: number;
  readonly strength: number;
  readonly direction: 1 | -1;
}

/**
 * The silhouette that anchors the cast shadow is the one the viewer sees, so it
 * is measured after the perspective projection. Everything else the shadow
 * reads is physical: the material edge decides when the sheet clears the spine,
 * and its velocity drives the flattening response.
 */
export function summarizePageTurnShadow(
  points: readonly RolledPagePoint[],
  metrics: RolledPageMetrics,
  xScale: 1 | -1 = 1,
  cameraBookX = pageTurnCameraBookXForLayout(false),
): PageTurnShadow {
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const x = projectPageTurnBookX(point.x * xScale, point.z, cameraBookX);
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
  }
  const direction = xScale;
  const edgeX = metrics.edgeX * xScale;
  const edgeVelocityX = metrics.edgeVelocityX * xScale;
  const shadow = [0, 0, 0, direction];
  updateDynamicPageTurnShadow(
    shadow,
    minimumX,
    maximumX,
    edgeX,
    edgeVelocityX,
    metrics.curvature,
    metrics.flatteningRate,
    metrics.maxLift,
    metrics.meanSpeed,
    direction,
    false,
  );
  return {
    center: shadow[0]!,
    width: shadow[1]!,
    strength: shadow[2]!,
    direction,
  };
}
