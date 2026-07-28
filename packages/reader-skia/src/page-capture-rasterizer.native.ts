import { Skia, type SkImage } from "@shopify/react-native-skia";
import {
  createWorkletRuntime,
  runOnRuntimeAsync,
  type WorkletRuntime,
} from "react-native-worklets";

import {
  capturedPageFromImage,
  type CapturedPage,
  type RecordedPageCapture,
} from "./page-capture";

export const PAGE_CAPTURE_RASTER_WORKER_COUNT = 2;

const rasterWorkers: readonly WorkletRuntime[] = Array.from(
  { length: PAGE_CAPTURE_RASTER_WORKER_COUNT },
  (_, index) =>
    createWorkletRuntime({
      name: `persimmon-page-raster-${index + 1}`,
    }),
);
let nextWorker = 0;

interface RasterWorkerResult {
  readonly image: SkImage;
  readonly rasterMs: number;
}

interface RasterThreadSurfaceFactory {
  configureCurrentThreadForRaster?: (workerIndex: number) => boolean;
}

function rasterizePictureOnWorker(
  picture: RecordedPageCapture["picture"],
  pixelWidth: number,
  pixelHeight: number,
  workerIndex: number,
): RasterWorkerResult | null {
  "worklet";
  const workerGlobal = globalThis as typeof globalThis & {
    __persimmonRasterThreadConfigured?: boolean;
  };
  if (!workerGlobal.__persimmonRasterThreadConfigured) {
    const surfaceFactory =
      Skia.Surface as unknown as RasterThreadSurfaceFactory;
    surfaceFactory.configureCurrentThreadForRaster?.(workerIndex);
    workerGlobal.__persimmonRasterThreadConfigured = true;
  }
  const startedAt = Date.now();
  // Surface.Make is Skia's CPU raster surface. It has no GPU context and its
  // snapshot is therefore safe to sample from the render runtime.
  const surface = Skia.Surface.Make(pixelWidth, pixelHeight);
  if (!surface) {
    return null;
  }
  const canvas = surface.getCanvas();
  canvas.drawPicture(picture);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return {
    image,
    rasterMs: Math.max(0, Date.now() - startedAt),
  };
}

/**
 * Replays an immutable page display list on a dedicated native Worklet
 * runtimes. The primary worker occupies the fastest CPU below the compositor;
 * one lower-priority helper occupies the next CPU and absorbs cold-page tail
 * latency. Both yield to UI work through positive nice values.
 */
export async function rasterizePageCaptureOffThread(
  recording: RecordedPageCapture,
): Promise<CapturedPage | null> {
  const workerIndex = nextWorker++ % rasterWorkers.length;
  const worker = rasterWorkers[workerIndex]!;
  const result = await runOnRuntimeAsync(
    worker,
    rasterizePictureOnWorker,
    recording.picture,
    recording.pixelWidth,
    recording.pixelHeight,
    workerIndex,
  );
  if (!result) {
    return null;
  }
  return capturedPageFromImage(result.image, recording);
}
