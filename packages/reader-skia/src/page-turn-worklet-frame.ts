import {
  DEFAULT_PAGE_PROFILE_POINTS,
  PAGE_TURN_WORKLET_COMPLETED,
  type PageTurnWorkletState,
} from "@persimmon/page-turn-core";

import { updateDynamicPageTurnShadow } from "./page-turn-shadow-physics";
import { isPageTurnSourceFacing, pageTurnXScale } from "./page-turn-direction";
import {
  limitPageTurnMaterialSlope,
  pageTurnCameraBookX,
  pageTurnPerspectiveCorrectProgress,
  pageTurnPerspectiveProgressDerivative,
  projectPageTurnBookX,
} from "./page-turn-perspective";
import { incomingPageProjectedOffset } from "./page-turn-incoming-reveal";

const PROFILE_FLOATS_PER_POINT = 4;
const PROFILE_X = 0;
const PROFILE_Z = 1;
const PROFILE_NORMAL_Z = 3;
const PAGE_TURN_SEGMENT_COUNT = DEFAULT_PAGE_PROFILE_POINTS - 1;

export interface PageTurnRenderFrame {
  /**
   * Reused plain arrays are intentional. Skia 2.6.2's Reanimated recorder
   * cannot recognize a Float32Array created in another runtime, while a
   * normal array remains shareable and is flattened correctly.
   */
  readonly mapping: number[];
  readonly shadow: number[];
}

export interface PageTurnRenderScratch {
  readonly visibleDepth: Float32Array;
}

export function createPageTurnRenderFrame(
  sampleCount: number,
): PageTurnRenderFrame {
  return {
    mapping: new Array<number>(sampleCount * 4).fill(0),
    shadow: [0.5, 0.045, 0, 1],
  };
}

export function createPageTurnRenderScratch(
  sampleCount: number,
): PageTurnRenderScratch {
  return {
    visibleDepth: new Float32Array(sampleCount),
  };
}

function interpolate(start: number, end: number, progress: number): number {
  "worklet";
  return start + (end - start) * progress;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}

function surfaceLight(
  profile: Float32Array,
  segmentIndex: number,
  progress: number,
  sourceFacing: boolean,
): number {
  "worklet";
  const offset = segmentIndex * PROFILE_FLOATS_PER_POINT;
  const normalZ = Math.abs(
    interpolate(
      profile[offset + PROFILE_NORMAL_Z]!,
      profile[offset + PROFILE_FLOATS_PER_POINT + PROFILE_NORMAL_Z]!,
      progress,
    ),
  );
  const deformation = 1 - normalZ;
  const curvatureShadow = deformation * 0.16;
  const undersideShadow = sourceFacing ? 0 : deformation * 0.055;
  return 1 - Math.min(0.2, curvatureShadow + undersideShadow);
}

/**
 * Rasterizes the 64 material segments into screen-x cells on the UI runtime.
 *
 * The previous implementation visited every segment for every cell
 * (`samples × 64`). This one depth-rasterizes only the cells touched by each
 * segment, so an inextensible one-page strip is normally O(samples + 64).
 * Buffers are allocated once and mutated in place.
 */
export function updatePageTurnRenderFrame(
  state: PageTurnWorkletState,
  frame: PageTurnRenderFrame,
  scratch: PageTurnRenderScratch,
  minimumBookX: number,
  maximumBookX: number,
): void {
  "worklet";
  const mapping = frame.mapping;
  const visibleDepth = scratch.visibleDepth;
  const sampleCount = visibleDepth.length;
  const bookXSpan = Math.max(0.000001, maximumBookX - minimumBookX);
  const halfCellBookX = (0.5 * bookXSpan) / sampleCount;
  const cameraBookX = pageTurnCameraBookX(minimumBookX, maximumBookX);
  const xScale = pageTurnXScale(state.direction);
  const projectedOffset = incomingPageProjectedOffset(
    state.profile,
    cameraBookX,
    xScale,
    state.settlingIncomingPage ? state.settlingProgress : undefined,
  );

  for (let sample = 0; sample < sampleCount; sample += 1) {
    visibleDepth[sample] = Number.NEGATIVE_INFINITY;
    const lookupOffset = sample * 4;
    mapping[lookupOffset] = 0;
    mapping[lookupOffset + 1] = 0;
    mapping[lookupOffset + 2] = 1;
    mapping[lookupOffset + 3] = 0;
  }

  const profile = state.profile;
  for (
    let segmentIndex = 0;
    segmentIndex < PAGE_TURN_SEGMENT_COUNT;
    segmentIndex += 1
  ) {
    const offset = segmentIndex * PROFILE_FLOATS_PER_POINT;
    const startDepth = profile[offset + PROFILE_Z]!;
    const endDepth = profile[offset + PROFILE_FLOATS_PER_POINT + PROFILE_Z]!;
    const startX =
      projectPageTurnBookX(
        profile[offset + PROFILE_X]! * xScale,
        startDepth,
        cameraBookX,
      ) + projectedOffset;
    const endX =
      projectPageTurnBookX(
        profile[offset + PROFILE_FLOATS_PER_POINT + PROFILE_X]! * xScale,
        endDepth,
        cameraBookX,
      ) + projectedOffset;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 0.000001) {
      continue;
    }
    const intervalStart = Math.max(minimumBookX, Math.min(startX, endX));
    const intervalEnd = Math.min(maximumBookX, Math.max(startX, endX));
    if (intervalEnd < intervalStart) {
      continue;
    }

    const firstSample = clampInteger(
      Math.ceil(
        ((intervalStart - minimumBookX) / bookXSpan) * sampleCount - 0.5,
      ),
      0,
      sampleCount - 1,
    );
    const lastSample = clampInteger(
      Math.floor(
        ((intervalEnd - minimumBookX) / bookXSpan) * sampleCount - 0.5,
      ),
      0,
      sampleCount - 1,
    );
    if (lastSample < firstSample) {
      continue;
    }

    const frontFacing = deltaX > 0;
    for (let sample = firstSample; sample <= lastSample; sample += 1) {
      const bookX = minimumBookX + ((sample + 0.5) / sampleCount) * bookXSpan;
      const screenProgress = (bookX - startX) / deltaX;
      if (screenProgress < -0.000001 || screenProgress > 1.000001) {
        continue;
      }
      const progress = pageTurnPerspectiveCorrectProgress(
        screenProgress,
        startDepth,
        endDepth,
      );
      const depth = interpolate(startDepth, endDepth, progress);
      if (depth <= visibleDepth[sample]!) {
        continue;
      }
      visibleDepth[sample] = depth;
      const lookupOffset = sample * 4;
      mapping[lookupOffset] =
        (segmentIndex + progress) / PAGE_TURN_SEGMENT_COUNT;
      mapping[lookupOffset + 1] = limitPageTurnMaterialSlope(
        pageTurnPerspectiveProgressDerivative(
          screenProgress,
          startDepth,
          endDepth,
        ) /
          (PAGE_TURN_SEGMENT_COUNT * deltaX),
        PAGE_TURN_SEGMENT_COUNT,
        halfCellBookX,
      );
      mapping[lookupOffset + 2] = surfaceLight(
        profile,
        segmentIndex,
        progress,
        isPageTurnSourceFacing(state.direction, frontFacing),
      );
      mapping[lookupOffset + 3] =
        (frontFacing ? 1 : -1) * (1 + Math.max(0, depth));
    }
  }

  // The cast shadow hugs the silhouette the viewer sees, so it follows the
  // projected edge rather than the physical one.
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    const x =
      projectPageTurnBookX(
        profile[offset + PROFILE_X]! * xScale,
        profile[offset + PROFILE_Z]!,
        cameraBookX,
      ) + projectedOffset;
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
  }
  const edgeOffset =
    (DEFAULT_PAGE_PROFILE_POINTS - 1) * PROFILE_FLOATS_PER_POINT;
  updateDynamicPageTurnShadow(
    frame.shadow,
    minimumX,
    maximumX,
    profile[edgeOffset + PROFILE_X]! * xScale,
    state.edgeVelocityX * xScale,
    state.curvature,
    state.flatteningRate,
    state.maxLift,
    state.meanSpeed,
    state.direction,
    state.phase === PAGE_TURN_WORKLET_COMPLETED,
  );
}
