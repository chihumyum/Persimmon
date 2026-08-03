import {
  DEFAULT_PAGE_PROFILE_POINTS,
  PAGE_TURN_WORKLET_COMPLETED,
  type PageTurnWorkletState,
} from "@persimmon/page-turn-core";

import { updateDynamicPageTurnShadow } from "./page-turn-shadow-physics";
import { pageTurnXScale } from "./page-turn-direction";
import {
  PAGE_TURN_CAMERA_DISTANCE,
  PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  pageTurnCameraBookX,
  projectPageTurnBookX,
} from "./page-turn-perspective";
import { incomingPageProjectedOffset } from "./page-turn-incoming-reveal";

const PROFILE_FLOATS_PER_POINT = 4;
const PROFILE_X = 0;
const PROFILE_NORMAL_X = 2;
/**
 * The profile tangent is cos(rotation + amplitude * cos(PI * material)).
 * Its angle is monotonic across the sheet and spans less than 2 PI for every
 * supported amplitude. Perspective can introduce one additional projected
 * extremum while a hand-held roll stays tightly curved through the vertical
 * pose, so reserve four screen-x monotonic runs.
 */
export const NATIVE_PAGE_PROFILE_RUNS = 4;

export interface PageTurnShadowUniforms {
  readonly [name: string]: number[];
  readonly geometry: number[];
  readonly pageSize: number[];
  readonly shadow: number[];
}

export interface PageTurnPaperUniforms {
  readonly [name: string]: number[];
  readonly geometry: number[];
  readonly pageSize: number[];
  readonly perspective: number[];
  readonly profile: number[];
  readonly runs: number[];
}

export interface PageTurnPaperRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageTurnNativeFrame {
  /**
   * The arrays and object are allocated once. Reanimated notifies Skia after
   * they are mutated on the UI runtime; no per-frame RN-JS object is created.
   */
  readonly shadowUniforms: PageTurnShadowUniforms;
  readonly paperUniforms: PageTurnPaperUniforms;
  readonly paperRect: PageTurnPaperRect;
}

export function createPageTurnNativeFrame(
  width: number,
  height: number,
  spread: boolean,
): PageTurnNativeFrame {
  const paperWidth = spread ? width * 0.5 : width;
  const spineX = spread ? paperWidth : 0;
  const minimumBookX = spread ? -1 : 0;
  const maximumBookX = 1;
  const frame: PageTurnNativeFrame = {
    shadowUniforms: {
      geometry: [spineX, paperWidth, minimumBookX, maximumBookX - minimumBookX],
      pageSize: [width, height],
      shadow: [0.5, 0.045, 0, 1],
    },
    paperUniforms: {
      geometry: [
        spineX,
        paperWidth,
        DEFAULT_PAGE_PROFILE_POINTS - 1,
        NATIVE_PAGE_PROFILE_RUNS,
      ],
      pageSize: [width, height],
      perspective: [
        pageTurnCameraBookX(minimumBookX, maximumBookX),
        PAGE_TURN_CAMERA_DISTANCE,
        PAGE_TURN_MAX_PERSPECTIVE_SCALE,
        1,
      ],
      profile: new Array<number>(
        DEFAULT_PAGE_PROFILE_POINTS * PROFILE_FLOATS_PER_POINT,
      ).fill(0),
      runs: new Array<number>(NATIVE_PAGE_PROFILE_RUNS * 4).fill(0),
    },
    // A persistent native lane is invisible until its command installs a
    // direction-correct worklet profile. This prevents a backward turn from
    // painting the default forward profile for one frame.
    paperRect: { x: 0, y: 0, width: 0, height },
  };
  const profile = frame.paperUniforms.profile;
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    profile[offset + PROFILE_X] = index / (DEFAULT_PAGE_PROFILE_POINTS - 1);
    profile[offset + 1] = 0;
    profile[offset + PROFILE_NORMAL_X] = 0;
    profile[offset + 3] = 1;
  }
  frame.paperUniforms.runs[0] = 0;
  frame.paperUniforms.runs[1] = DEFAULT_PAGE_PROFILE_POINTS - 1;
  frame.paperUniforms.runs[2] = 1;
  frame.paperUniforms.runs[3] = 1;
  return frame;
}

export function resetPageTurnNativeFrameViewportValues(
  paperUniforms: PageTurnPaperUniforms,
  shadowUniforms: PageTurnShadowUniforms,
  paperRect: PageTurnPaperRect,
  width: number,
  height: number,
  spread: boolean,
): void {
  "worklet";
  const hidden = paperRect.width <= 0;
  const paperWidth = spread ? width * 0.5 : width;
  const spineX = spread ? paperWidth : 0;
  const minimumBookX = spread ? -1 : 0;
  const geometry = paperUniforms.geometry;
  geometry[0] = spineX;
  geometry[1] = paperWidth;
  geometry[2] = DEFAULT_PAGE_PROFILE_POINTS - 1;
  geometry[3] = NATIVE_PAGE_PROFILE_RUNS;

  const shadowGeometry = shadowUniforms.geometry;
  shadowGeometry[0] = spineX;
  shadowGeometry[1] = paperWidth;
  shadowGeometry[2] = minimumBookX;
  shadowGeometry[3] = 1 - minimumBookX;

  const paperPageSize = paperUniforms.pageSize;
  paperPageSize[0] = width;
  paperPageSize[1] = height;
  const shadowPageSize = shadowUniforms.pageSize;
  shadowPageSize[0] = width;
  shadowPageSize[1] = height;
  paperUniforms.perspective[0] = pageTurnCameraBookX(minimumBookX, 1);

  paperRect.x = 0;
  paperRect.y = 0;
  paperRect.width = hidden ? 0 : width;
  paperRect.height = height;
}

/**
 * Reconfigures a persistent frame after a viewport or layout change. This is
 * intentionally separate from the per-frame update so a single/spread toggle
 * never allocates inside the animation loop.
 */
export function resetPageTurnNativeFrameViewport(
  frame: PageTurnNativeFrame,
  width: number,
  height: number,
  spread: boolean,
): void {
  "worklet";
  resetPageTurnNativeFrameViewportValues(
    frame.paperUniforms,
    frame.shadowUniforms,
    frame.paperRect,
    width,
    height,
    spread,
  );
}

export function updatePageTurnNativeFrameValues(
  state: PageTurnWorkletState,
  paperUniforms: PageTurnPaperUniforms,
  shadowUniforms: PageTurnShadowUniforms,
  paperRect: PageTurnPaperRect,
): void {
  "worklet";
  const profile = state.profile;
  const xScale = pageTurnXScale(state.direction);
  const projectedProfile = paperUniforms.profile;
  paperUniforms.perspective[3] = xScale;
  const cameraBookX = paperUniforms.perspective[0]!;
  const projectedOffset = incomingPageProjectedOffset(
    profile,
    cameraBookX,
    xScale,
    state.settlingIncomingPage ? state.settlingProgress : undefined,
  );
  let paperMinimumX = Number.POSITIVE_INFINITY;
  let paperMaximumX = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    const physicalX = profile[offset + PROFILE_X]! * xScale;
    const depth = profile[offset + 1]!;
    const projectedX =
      projectPageTurnBookX(physicalX, depth, cameraBookX) + projectedOffset;
    projectedProfile[offset + PROFILE_X] = projectedX;
    projectedProfile[offset + 1] = depth;
    projectedProfile[offset + PROFILE_NORMAL_X] =
      profile[offset + PROFILE_NORMAL_X]! * xScale;
    projectedProfile[offset + 3] = profile[offset + 3]!;
    paperMinimumX = Math.min(paperMinimumX, projectedX);
    paperMaximumX = Math.max(paperMaximumX, projectedX);
  }

  const runs = paperUniforms.runs;
  for (let index = 0; index < runs.length; index += 1) {
    runs[index] = 0;
  }
  let runCount = 0;
  let runStart = 0;
  let runDirection = 0;
  for (
    let segment = 0;
    segment < DEFAULT_PAGE_PROFILE_POINTS - 1;
    segment += 1
  ) {
    const startX =
      projectedProfile[segment * PROFILE_FLOATS_PER_POINT + PROFILE_X]!;
    const endX =
      projectedProfile[(segment + 1) * PROFILE_FLOATS_PER_POINT + PROFILE_X]!;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 0.000001) {
      continue;
    }
    const direction = deltaX > 0 ? 1 : -1;
    if (runDirection === 0) {
      runDirection = direction;
      continue;
    }
    if (direction !== runDirection && runCount < NATIVE_PAGE_PROFILE_RUNS - 1) {
      const offset = runCount * 4;
      runs[offset] = runStart;
      runs[offset + 1] = segment;
      runs[offset + 2] = runDirection;
      runs[offset + 3] = 1;
      runCount += 1;
      runStart = segment;
      runDirection = direction;
    }
  }
  const finalRunOffset = runCount * 4;
  runs[finalRunOffset] = runStart;
  runs[finalRunOffset + 1] = DEFAULT_PAGE_PROFILE_POINTS - 1;
  runs[finalRunOffset + 2] = runDirection === 0 ? 1 : runDirection;
  runs[finalRunOffset + 3] = 1;

  const geometry = paperUniforms.geometry;
  const viewportWidth = paperUniforms.pageSize[0]!;
  const viewportHeight = paperUniforms.pageSize[1]!;
  const paperMinimum = Math.max(
    0,
    geometry[0]! + paperMinimumX * geometry[1]! - 1,
  );
  const paperMaximum = Math.min(
    viewportWidth,
    geometry[0]! + paperMaximumX * geometry[1]! + 1,
  );
  paperRect.x = paperMinimum;
  paperRect.y = 0;
  paperRect.width = Math.max(0, paperMaximum - paperMinimum);
  paperRect.height = viewportHeight;
  if (state.settlingIncomingPage && state.settlingProgress <= 0) {
    paperRect.width = 0;
  }

  // The silhouette anchors the cast shadow on screen, so it is the projected
  // edge; the material edge and its velocity stay physical because they drive
  // the spine crossing and the flattening response.
  const shadow = shadowUniforms.shadow;
  const edgeOffset =
    (DEFAULT_PAGE_PROFILE_POINTS - 1) * PROFILE_FLOATS_PER_POINT;
  updateDynamicPageTurnShadow(
    shadow,
    paperMinimumX,
    paperMaximumX,
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

/**
 * Produces the compact shadow input on the UI runtime. The paper geometry is
 * read directly from the shared physical state by the native Skia mesh.
 */
export function updatePageTurnNativeFrame(
  state: PageTurnWorkletState,
  frame: PageTurnNativeFrame,
): void {
  "worklet";
  updatePageTurnNativeFrameValues(
    state,
    frame.paperUniforms,
    frame.shadowUniforms,
    frame.paperRect,
  );
}
