export interface LayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type SystemColumnSide = "left" | "right";

/**
 * Bottom edge of the system occlusions (camera, status bar) inside the column
 * the system reserves beside the content, or 0 when nothing covers it.
 * Controls placed in that column start below this line.
 */
export function systemColumnOcclusionBottom(
  occlusions: readonly LayoutRect[],
  windowWidth: number,
  side: SystemColumnSide,
  width: number,
): number {
  const columnStart = side === "left" ? 0 : windowWidth - width;
  const columnEnd = columnStart + width;
  return occlusions
    .filter((rect) => rect.x < columnEnd && rect.x + rect.width > columnStart)
    .reduce((bottom, rect) => Math.max(bottom, rect.y + rect.height), 0);
}

/**
 * Distance from the screen edge to the line the system centers a vertical
 * column's content on when no camera marks it. Measured on the iPhone Duo
 * (iOS 27.1 simulator): the column is 84pt wide, yet the outer camera, the
 * clock and the Wi-Fi glyph are all centered 48pt in from the screen edge,
 * not on the column's own center 42pt in.
 */
export const SYSTEM_COLUMN_CONTENT_EDGE_INSET = 48;

/**
 * Distance from the screen edge on the column's side to the center line of
 * the system column's content, so controls placed in the column line up with
 * the camera, the clock and the Wi-Fi glyph above them. A camera inside the
 * column defines that line; otherwise the measured inset does.
 */
export function systemColumnCenterInset(
  occlusions: readonly LayoutRect[],
  windowWidth: number,
  side: SystemColumnSide,
  width: number,
): number {
  const columnStart = side === "left" ? 0 : windowWidth - width;
  const columnEnd = columnStart + width;
  const camera = occlusions.find(
    (rect) =>
      rect.width < width - 1 &&
      rect.x >= columnStart - 1 &&
      rect.x + rect.width <= columnEnd + 1,
  );
  if (!camera) {
    return Math.min(width, SYSTEM_COLUMN_CONTENT_EDGE_INSET);
  }
  const center = camera.x + camera.width / 2;
  return side === "left" ? center : windowWidth - center;
}
