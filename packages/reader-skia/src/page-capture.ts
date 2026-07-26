import type { PageScene, PaginationResult } from "@persimmon/layout";
import {
  ClipOp,
  Skia,
  type SkImage,
  type SkParagraph,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

import type { DecodedImageCache } from "./image-cache";
import { pageCapturePixelSize } from "./page-capture-budget";
import type { ReaderProgressDisplay } from "./reader-appearance";
import { READER_PAPER_COLOR } from "./reader-theme";
import { afterSkiaPaint } from "./skia-lifecycle";
import {
  drawSkiaPageDecoration,
  type SkiaPageDecoration,
} from "./skia-page-decoration";
import { releaseSkiaResources } from "./skia-resource-release";

export interface CapturedPage {
  readonly image: SkImage;
  readonly scale: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly byteSize: number;
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
  scale: number,
  allowUnrequestedImages = false,
  decoration?: SkiaPageDecoration,
  progressDisplay: ReaderProgressDisplay = "hidden",
): CapturedPage | null {
  if (!pageImagesSettledForCapture(page, imageCache, allowUnrequestedImages)) {
    return null;
  }
  const pixelSize = pageCapturePixelSize(width, height, scale);
  if (!pixelSize) {
    return null;
  }

  const pixelWidth = pixelSize.width;
  const pixelHeight = pixelSize.height;
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
  const notePaint = Skia.Paint();
  placeholderPaint.setColor(Skia.Color("#eed9c8"));
  notePaint.setColor(Skia.Color("#c97a52"));
  let returnedCapture = false;
  let surfaceDisposed = false;

  try {
    canvas.clear(Skia.Color(READER_PAPER_COLOR));
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
      if (item.noteKind) {
        canvas.drawRect(
          Skia.XYWHRect(item.frame.x - 10, item.frame.y, 2, item.frame.height),
          notePaint,
        );
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
    if (decoration) {
      drawSkiaPageDecoration(canvas, decoration, progressDisplay);
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
      pixelWidth,
      pixelHeight,
      byteSize: pixelSize.byteSize,
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
      "[Persimmon] Page capture failed; skipping the textured page turn.",
      error,
    );
    return null;
  } finally {
    imagePaint.dispose();
    placeholderPaint.dispose();
    notePaint.dispose();
    if (!returnedCapture && !surfaceDisposed) {
      surface.dispose();
    }
  }
}

/**
 * A transition texture must not freeze a temporary loading placeholder into
 * the page. Unavailable assets are settled and may use the fallback rectangle;
 * actively decoding assets must make capture wait and retry. An unrequested
 * asset is also allowed to settle as a placeholder when the reader has no
 * resource loader that could ever resolve it.
 */
export function pageImagesSettledForCapture(
  page: Pick<PageScene, "items">,
  imageCache: Pick<DecodedImageCache, "getStatus">,
  allowUnrequestedImages = false,
): boolean {
  return page.items.every((item) => {
    if (item.kind !== "image") {
      return true;
    }
    const status = imageCache.getStatus(item.assetId);
    return (
      status === "ready" ||
      status === "unavailable" ||
      (allowUnrequestedImages && status === "unrequested")
    );
  });
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
