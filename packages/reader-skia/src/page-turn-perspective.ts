/**
 * The physical page profile uses one page width as its depth unit. A camera
 * four page-widths away produces a strong but still readable 1.33x lift at the
 * top of the curl, close to the centered perspective used by Play Books.
 */
export const PAGE_TURN_CAMERA_DISTANCE = 4;
export const PAGE_TURN_MAX_PERSPECTIVE_SCALE = 1.34;

export function pageTurnCameraBookX(
  minimumBookX: number,
  maximumBookX: number,
): number {
  "worklet";
  return (minimumBookX + maximumBookX) * 0.5;
}

/**
 * A spread spans bookX -1..1, a single page 0..1, so the viewer's focus sits on
 * the spine in the first case and on the page center in the second.
 */
export function pageTurnCameraBookXForLayout(spread: boolean): number {
  "worklet";
  return pageTurnCameraBookX(spread ? -1 : 0, 1);
}

export function pageTurnPerspectiveScale(depth: number): number {
  "worklet";
  const visibleDepth = Math.max(0, depth);
  return Math.min(
    PAGE_TURN_MAX_PERSPECTIVE_SCALE,
    PAGE_TURN_CAMERA_DISTANCE /
      Math.max(0.001, PAGE_TURN_CAMERA_DISTANCE - visibleDepth),
  );
}

/**
 * Projects a profile point around the viewer's horizontal focus. A spread is
 * focused on the spine (bookX 0); a single page is focused on its center
 * (bookX 0.5).
 */
export function projectPageTurnBookX(
  bookX: number,
  depth: number,
  cameraBookX: number,
): number {
  "worklet";
  const scale = pageTurnPerspectiveScale(depth);
  return cameraBookX + (bookX - cameraBookX) * scale;
}

/**
 * Converts affine progress along a projected segment back to the physical
 * paper segment. Without this correction, letters shear as the two segment
 * endpoints approach the camera by different amounts.
 */
export function pageTurnPerspectiveCorrectProgress(
  screenProgress: number,
  startDepth: number,
  endDepth: number,
): number {
  "worklet";
  const startScale = pageTurnPerspectiveScale(startDepth);
  const endScale = pageTurnPerspectiveScale(endDepth);
  const denominator =
    (1 - screenProgress) * startScale + screenProgress * endScale;
  if (denominator <= 0.000001) {
    return screenProgress;
  }
  return (screenProgress * endScale) / denominator;
}

/**
 * Inverse pinhole projection for the vertical texture coordinate. The screen
 * center stays fixed while raised paper grows equally beyond the top and
 * bottom of the viewport.
 */
export function inversePageTurnProjectedY(
  screenY: number,
  depth: number,
): number {
  "worklet";
  return 0.5 + (screenY - 0.5) / pageTurnPerspectiveScale(depth);
}
