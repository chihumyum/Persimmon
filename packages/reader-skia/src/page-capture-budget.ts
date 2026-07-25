export const PAGE_CAPTURE_MAX_SCALE = 2;
export const PAGE_CAPTURE_BYTE_BUDGET = 48 * 1024 * 1024;
export const PAGE_CAPTURE_CACHE_BYTE_BUDGET = 96 * 1024 * 1024;

export function pageCaptureEntryBudget(maximumEntries: number): number {
  const entries = Number.isFinite(maximumEntries)
    ? Math.max(1, Math.floor(maximumEntries))
    : 1;
  return Math.min(
    PAGE_CAPTURE_BYTE_BUDGET,
    PAGE_CAPTURE_CACHE_BYTE_BUDGET / entries,
  );
}

export function pageCaptureScale(
  width: number,
  height: number,
  byteBudget = PAGE_CAPTURE_BYTE_BUDGET,
): number | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(byteBudget) ||
    byteBudget <= 0
  ) {
    return null;
  }
  const baseBytes = width * height * 4;
  if (baseBytes > byteBudget) {
    return null;
  }
  return Math.min(PAGE_CAPTURE_MAX_SCALE, Math.sqrt(byteBudget / baseBytes));
}
