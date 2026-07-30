import { Skia, type SkImage } from "@shopify/react-native-skia";
import {
  createWorkletRuntime,
  runOnRuntimeAsync,
  type WorkletRuntime,
} from "react-native-worklets";
import { Platform } from "react-native";

import {
  capturedPageFromImage,
  rasterizeRecordedPageCapture,
  type CapturedPage,
  type RecordedPageCapture,
} from "./page-capture";

const supportsCrossRuntimeSkiaRaster = Platform.OS !== "ios";

export const PAGE_CAPTURE_RASTER_WORKER_COUNT = supportsCrossRuntimeSkiaRaster
  ? 2
  : 1;

let rasterWorkers: readonly WorkletRuntime[] | undefined;
let nextWorker = 0;

function getRasterWorkers(): readonly WorkletRuntime[] {
  rasterWorkers ??= Array.from(
    { length: PAGE_CAPTURE_RASTER_WORKER_COUNT },
    (_, index) =>
      createWorkletRuntime({
        name: `persimmon-page-raster-${index + 1}`,
      }),
  );
  return rasterWorkers;
}

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
  if (!supportsCrossRuntimeSkiaRaster) {
    // A SkPicture is a JSI HostObject tied to the runtime that created it.
    // Passing it into a second Hermes runtime on iOS retained two extra heaps
    // and made the RN runtime fail in HostObject::get under memory pressure.
    // Native Pager turns do not use this compatibility path; keeping the
    // fallback on the owning runtime preserves correctness without reducing
    // native Pager throughput.
    return rasterizeRecordedPageCapture(recording);
  }

  const workers = getRasterWorkers();
  const workerIndex = nextWorker++ % workers.length;
  const worker = workers[workerIndex]!;
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
