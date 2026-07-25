import { DEFAULT_PAGE_PROFILE_POINTS } from "@persimmon/page-turn-core";

import {
  isPageTurnSourceFacing,
  type PageTurnDirection,
} from "./page-turn-direction";
import {
  limitPageTurnMaterialSlope,
  pageTurnCameraBookX,
  pageTurnPerspectiveCorrectProgress,
  pageTurnPerspectiveProgressDerivative,
  projectPageTurnBookX,
} from "./page-turn-perspective";

const PROFILE_FLOATS_PER_POINT = 4;
const PROFILE_Z_OFFSET = 1;
const LOOKUP_SAMPLE_BUCKET = 32;
const MIN_LOOKUP_SAMPLES = 128;
const MAX_LOOKUP_SAMPLES = 512;
export const PAGE_TURN_SEGMENT_COUNT = DEFAULT_PAGE_PROFILE_POINTS - 1;

/**
 * Keeps the depth/face lookup at roughly one renderer coordinate per sample on
 * phones. Bucketing prevents recompiling a RuntimeEffect for every fractional
 * layout width, while the cap stays within conservative native uniform budgets
 * on wider tablet and desktop canvases.
 */
export function pageTurnLookupSampleCount(viewportWidth: number): number {
  const bucketed = Math.ceil(Math.max(1, viewportWidth) / LOOKUP_SAMPLE_BUCKET);
  return Math.min(
    MAX_LOOKUP_SAMPLES,
    Math.max(MIN_LOOKUP_SAMPLES, bucketed * LOOKUP_SAMPLE_BUCKET),
  );
}

/**
 * Packs the depth-buffer-visible material coordinate for fixed screen-x cells.
 *
 * Each float4 contains: material at the cell center,
 * d(material)/d(bookX), paper light, and signed face/depth
 * (sign selects the face, magnitude is 1 + visible depth, 0 is outside paper).
 */
export function buildPageTurnLookup(
  profile: ArrayLike<number>,
  sampleCount: number,
  minimumBookX = 0,
  maximumBookX = 1,
  direction: PageTurnDirection = 1,
): number[] {
  const safeSampleCount = Math.max(
    PAGE_TURN_SEGMENT_COUNT,
    Math.round(sampleCount),
  );
  const lookup = new Array<number>(safeSampleCount * 4);
  const bookXSpan = Math.max(0.000001, maximumBookX - minimumBookX);
  const halfCellBookX = (0.5 * bookXSpan) / safeSampleCount;
  const cameraBookX = pageTurnCameraBookX(minimumBookX, maximumBookX);

  for (let sample = 0; sample < safeSampleCount; sample += 1) {
    const bookX = minimumBookX + ((sample + 0.5) / safeSampleCount) * bookXSpan;
    let visibleSegment = -1;
    let visibleDepth = Number.NEGATIVE_INFINITY;
    let visibleProgress = 0;

    for (
      let segmentIndex = 0;
      segmentIndex < PAGE_TURN_SEGMENT_COUNT;
      segmentIndex += 1
    ) {
      const offset = segmentIndex * PROFILE_FLOATS_PER_POINT;
      const startDepth = profile[offset + PROFILE_Z_OFFSET]!;
      const endDepth =
        profile[offset + PROFILE_FLOATS_PER_POINT + PROFILE_Z_OFFSET]!;
      const startX = projectPageTurnBookX(
        profile[offset]!,
        startDepth,
        cameraBookX,
      );
      const endX = projectPageTurnBookX(
        profile[offset + PROFILE_FLOATS_PER_POINT]!,
        endDepth,
        cameraBookX,
      );
      const deltaX = endX - startX;
      if (
        Math.abs(deltaX) < 0.000001 ||
        bookX < Math.min(startX, endX) ||
        bookX > Math.max(startX, endX)
      ) {
        continue;
      }
      const screenProgress = (bookX - startX) / deltaX;
      const progress = pageTurnPerspectiveCorrectProgress(
        screenProgress,
        startDepth,
        endDepth,
      );
      const depth = interpolate(startDepth, endDepth, progress);
      if (depth > visibleDepth) {
        visibleDepth = depth;
        visibleSegment = segmentIndex;
        visibleProgress = progress;
      }
    }

    const lookupOffset = sample * 4;
    if (visibleSegment < 0) {
      lookup[lookupOffset] = 0;
      lookup[lookupOffset + 1] = 0;
      lookup[lookupOffset + 2] = 1;
      lookup[lookupOffset + 3] = 0;
      continue;
    }

    const profileOffset = visibleSegment * PROFILE_FLOATS_PER_POINT;
    const startDepth = profile[profileOffset + PROFILE_Z_OFFSET]!;
    const endDepth =
      profile[profileOffset + PROFILE_FLOATS_PER_POINT + PROFILE_Z_OFFSET]!;
    const startX = projectPageTurnBookX(
      profile[profileOffset]!,
      startDepth,
      cameraBookX,
    );
    const endX = projectPageTurnBookX(
      profile[profileOffset + PROFILE_FLOATS_PER_POINT]!,
      endDepth,
      cameraBookX,
    );
    const deltaX = endX - startX;
    const frontFacing = deltaX > 0;
    lookup[lookupOffset] =
      (visibleSegment + visibleProgress) / PAGE_TURN_SEGMENT_COUNT;
    const screenProgress = (bookX - startX) / deltaX;
    lookup[lookupOffset + 1] = limitPageTurnMaterialSlope(
      pageTurnPerspectiveProgressDerivative(
        screenProgress,
        startDepth,
        endDepth,
      ) /
        (PAGE_TURN_SEGMENT_COUNT * deltaX),
      PAGE_TURN_SEGMENT_COUNT,
      halfCellBookX,
    );
    lookup[lookupOffset + 2] = pageTurnSurfaceLight(
      profile,
      visibleSegment,
      visibleProgress,
      isPageTurnSourceFacing(direction, frontFacing),
    );
    lookup[lookupOffset + 3] =
      (frontFacing ? 1 : -1) * (1 + Math.max(0, visibleDepth));
  }

  return lookup;
}

function pageTurnSurfaceLight(
  profile: ArrayLike<number>,
  segmentIndex: number,
  segmentProgress: number,
  sourceFacing: boolean,
): number {
  const offset = segmentIndex * PROFILE_FLOATS_PER_POINT;
  const normalZ = Math.abs(
    interpolate(
      profile[offset + 3]!,
      profile[offset + PROFILE_FLOATS_PER_POINT + 3]!,
      segmentProgress,
    ),
  );
  const deformation = 1 - normalZ;
  const curvatureShadow = deformation * 0.16;
  const undersideShadow = sourceFacing ? 0 : deformation * 0.055;
  const shadow = Math.min(0.2, curvatureShadow + undersideShadow);
  return 1 - shadow;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
