import type { CapturedPage, RecordedPageCapture } from "./page-capture";
import { rasterizeRecordedPageCapture } from "./page-capture";

export const PAGE_CAPTURE_RASTER_WORKER_COUNT = 1;

/**
 * Web does not expose native worker runtimes. Keep its existing portable CPU
 * path while native resolves this module to page-capture-rasterizer.native.ts.
 */
export async function rasterizePageCaptureOffThread(
  recording: RecordedPageCapture,
): Promise<CapturedPage | null> {
  return rasterizeRecordedPageCapture(recording);
}
