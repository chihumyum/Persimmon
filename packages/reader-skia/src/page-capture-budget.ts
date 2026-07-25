export const PAGE_CAPTURE_BYTES_PER_PIXEL = 4;
export const PAGE_CAPTURE_MIN_SCALE = 1;
export const PAGE_CAPTURE_MAX_SCALE = 3;
export const PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET = 128 * 1024 * 1024;
export const PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET = 192 * 1024 * 1024;

export interface PageCapturePixelSize {
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export function pageCapturePixelSize(
  width: number,
  height: number,
  scale: number,
): PageCapturePixelSize | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(scale) ||
    width <= 0 ||
    height <= 0 ||
    scale <= 0
  ) {
    return null;
  }
  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  return {
    width: pixelWidth,
    height: pixelHeight,
    byteSize: pixelWidth * pixelHeight * PAGE_CAPTURE_BYTES_PER_PIXEL,
  };
}
