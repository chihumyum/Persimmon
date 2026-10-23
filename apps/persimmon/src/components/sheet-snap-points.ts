/** Smallest step that keeps clamped detents distinct for the native sheet. */
const DETENT_SEPARATION = 0.001;

/**
 * Caps sheet snap points so the sheet's top edge stays at or below
 * `maximumHeight` from the bottom of the window. The iPhone Duo outer display
 * keeps its camera and status bar in a column beside the content; a sheet
 * that stops below them can run its rows and its close button through that
 * column exactly as it does on every other iPhone.
 *
 * Snap points become window fractions. Points that clamp to the same height
 * are nudged apart so each index still names its own detent.
 */
export function clampSheetSnapPoints(
  snapPoints: readonly (number | string)[],
  windowHeight: number,
  maximumHeight: number,
): string[] {
  if (windowHeight <= 0) {
    return snapPoints.map(String);
  }
  const maximumFraction = Math.min(
    1,
    Math.max(0, maximumHeight / windowHeight),
  );
  const used = new Set<number>();
  return snapPoints.map((point) => {
    let fraction = Math.min(
      maximumFraction,
      snapPointFraction(point, windowHeight),
    );
    while (used.has(Math.round(fraction / DETENT_SEPARATION))) {
      fraction -= DETENT_SEPARATION;
    }
    used.add(Math.round(fraction / DETENT_SEPARATION));
    return `${(fraction * 100).toFixed(1)}%`;
  });
}

function snapPointFraction(point: number | string, windowHeight: number) {
  if (typeof point === "number") {
    return point / windowHeight;
  }
  if (point.endsWith("%")) {
    return Number.parseFloat(point) / 100;
  }
  return Number.parseFloat(point) / windowHeight;
}
