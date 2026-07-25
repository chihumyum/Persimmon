import type { PageScene, PaginationResult } from "@persimmon/layout";
import {
  ClipOp,
  Skia,
  type SkImage,
  type SkParagraph,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

import type { DecodedImageCache } from "./image-cache";
import {
  PAGE_CAPTURE_BYTE_BUDGET,
  pageCaptureScale,
} from "./page-capture-budget";
import { afterSkiaPaint } from "./skia-lifecycle";
import { releaseSkiaResources } from "./skia-resource-release";

export interface CapturedPage {
  readonly image: SkImage;
  readonly scale: number;
  dispose(): void;
}

/**
 * Skia may retain an image pointer until the next Canvas commits. Disposing a
 * transition snapshot synchronously from a React effect cleanup can therefore
 * leave the previous frame holding a deleted JSI object.
 */
export function disposeCapturedPageAfterPaint(capture: CapturedPage): void {
  afterSkiaPaint(() => capture.dispose());
}

export function capturePage(
  page: PageScene,
  pagination: PaginationResult<SkParagraph>,
  imageCache: DecodedImageCache,
  width: number,
  height: number,
  byteBudget = PAGE_CAPTURE_BYTE_BUDGET,
): CapturedPage | null {
  const scale = pageCaptureScale(width, height, byteBudget);
  if (scale === null) {
    return null;
  }

  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  // CanvasKit GPU surfaces may belong to a different WebGL context than the
  // visible Canvas, so Web captures start on a CPU surface. Native records on
  // the faster offscreen GPU surface and converts the final snapshot to a
  // portable raster image below.
  const surface =
    Platform.OS === "web"
      ? Skia.Surface.Make(pixelWidth, pixelHeight)
      : Skia.Surface.MakeOffscreen(pixelWidth, pixelHeight);
  if (!surface) {
    return null;
  }

  const canvas = surface.getCanvas();
  const imagePaint = Skia.Paint();
  const placeholderPaint = Skia.Paint();
  placeholderPaint.setColor(Skia.Color("#eed9c8"));
  let returnedCapture = false;
  let surfaceDisposed = false;

  try {
    canvas.clear(Skia.Color("#fbf7f0"));
    canvas.scale(scale, scale);

    for (const item of page.items) {
      if (item.kind === "image") {
        const image = imageCache.get(item.assetId);
        if (!image) {
          canvas.drawRect(
            Skia.XYWHRect(
              item.frame.x,
              item.frame.y,
              item.frame.width,
              item.frame.height,
            ),
            placeholderPaint,
          );
          continue;
        }

        const fitted = containRect(image.width(), image.height(), item.frame);
        canvas.drawImageRect(
          image,
          Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(fitted.x, fitted.y, fitted.width, fitted.height),
          imagePaint,
        );
        continue;
      }

      const measured = pagination.paragraphs.get(item.paragraphKey);
      if (!measured) {
        continue;
      }
      canvas.save();
      canvas.clipRect(item.frame, ClipOp.Intersect, true);
      measured.handle.paint(
        canvas,
        item.frame.x,
        item.frame.y - item.sourceTop,
      );
      canvas.restore();
    }

    surface.flush();
    const textureImage = surface.makeImageSnapshot();
    // A GPU snapshot is tied to the surface/context that created it. Native
    // page-turn rendering samples the capture again from another surface, so
    // convert it to a portable raster image when Skia exposes that capability.
    const rasterImage =
      typeof textureImage.makeNonTextureImage === "function"
        ? textureImage.makeNonTextureImage()
        : null;
    const image = rasterImage ?? textureImage;
    if (rasterImage && rasterImage !== textureImage) {
      textureImage.dispose();
      surface.dispose();
      surfaceDisposed = true;
    }
    let retainedImage: SkImage | null = image;
    let retainedSurface = surfaceDisposed ? null : surface;
    let disposed = false;
    returnedCapture = true;
    return {
      get image() {
        if (!retainedImage) {
          throw new Error("Captured page was accessed after owner release.");
        }
        return retainedImage;
      },
      scale,
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        const imageToRelease = retainedImage;
        const surfaceToRelease = retainedSurface;
        retainedImage = null;
        retainedSurface = null;
        surfaceDisposed = true;
        releaseSkiaResources(Platform.OS, imageToRelease, surfaceToRelease);
      },
    };
  } catch (error) {
    console.warn(
      "[Persimmon] Page capture failed; using slide fallback.",
      error,
    );
    return null;
  } finally {
    imagePaint.dispose();
    placeholderPaint.dispose();
    if (!returnedCapture && !surfaceDisposed) {
      surface.dispose();
    }
  }
}

function containRect(
  sourceWidth: number,
  sourceHeight: number,
  destination: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
) {
  const scale = Math.min(
    destination.width / sourceWidth,
    destination.height / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: destination.x + (destination.width - width) / 2,
    y: destination.y + (destination.height - height) / 2,
    width,
    height,
  };
}
