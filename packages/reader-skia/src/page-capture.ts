import type { PageScene, PaginationResult } from "@persimmon/layout";
import {
  ClipOp,
  Skia,
  type SkImage,
  type SkParagraph,
  type SkPicture,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

import type { DecodedImageCache } from "./image-cache";
import { pageCapturePixelSize } from "./page-capture-budget";
import type { ReaderProgressDisplay } from "./reader-appearance";
import type { PageProgressPresentation } from "./page-progress-decoration";
import { DEFAULT_READER_THEME, type ReaderTheme } from "./reader-theme";
import { afterSkiaPaint } from "./skia-lifecycle";
import {
  drawSkiaPageDecoration,
  type SkiaPageDecoration,
} from "./skia-page-decoration";
import { releaseCapturedPageResources } from "./skia-resource-release";

export interface CapturedPage {
  readonly image: SkImage;
  readonly scale: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly byteSize: number;
  dispose(): void;
}

export interface RecordedPageCapture {
  readonly picture: SkPicture;
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
  progressPresentation: PageProgressPresentation = "reading",
  theme: ReaderTheme = DEFAULT_READER_THEME,
  decorationOffsetX = 0,
): CapturedPage | null {
  const recording = recordPageCapture(
    page,
    pagination,
    imageCache,
    width,
    height,
    scale,
    allowUnrequestedImages,
    decoration,
    progressDisplay,
    progressPresentation,
    theme,
    decorationOffsetX,
  );
  if (!recording) {
    return null;
  }
  try {
    return rasterizeRecordedPageCapture(recording);
  } finally {
    recording.dispose();
  }
}

/**
 * Records a complete physical page without allocating its pixel buffer.
 *
 * SkPicture is immutable after recording, so native can safely hand this
 * display list to a worker runtime. Paragraph layout and decoded images stay
 * shared while the expensive pixel fill happens away from RN and UI threads.
 */
export function recordPageCapture(
  page: PageScene,
  pagination: PaginationResult<SkParagraph>,
  imageCache: DecodedImageCache,
  width: number,
  height: number,
  scale: number,
  allowUnrequestedImages = false,
  decoration?: SkiaPageDecoration,
  progressDisplay: ReaderProgressDisplay = "hidden",
  progressPresentation: PageProgressPresentation = "reading",
  theme: ReaderTheme = DEFAULT_READER_THEME,
  decorationOffsetX = 0,
): RecordedPageCapture | null {
  if (!pageImagesSettledForCapture(page, imageCache, allowUnrequestedImages)) {
    return null;
  }
  const pixelSize = pageCapturePixelSize(width, height, scale);
  if (!pixelSize) {
    return null;
  }

  const pixelWidth = pixelSize.width;
  const pixelHeight = pixelSize.height;
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, pixelWidth, pixelHeight),
  );
  const imagePaint = Skia.Paint();
  const placeholderPaint = Skia.Paint();
  const notePaint = Skia.Paint();
  placeholderPaint.setColor(Skia.Color(theme.imagePlaceholder));
  notePaint.setColor(Skia.Color(theme.noteAccent));

  try {
    canvas.clear(Skia.Color(theme.paper));
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
      drawSkiaPageDecoration(
        canvas,
        decoration,
        progressDisplay,
        progressPresentation,
        decorationOffsetX,
      );
    }
    const picture = recorder.finishRecordingAsPicture();
    let retainedPicture: SkPicture | null = picture;
    let disposed = false;
    return {
      get picture() {
        if (!retainedPicture) {
          throw new Error(
            "Recorded page was accessed after its owner released it.",
          );
        }
        return retainedPicture;
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
        const pictureToRelease = retainedPicture;
        retainedPicture = null;
        pictureToRelease?.dispose();
      },
    };
  } catch (error) {
    console.warn(
      "[Persimmon] Page recording failed; skipping the textured page turn.",
      error,
    );
    return null;
  } finally {
    imagePaint.dispose();
    placeholderPaint.dispose();
    notePaint.dispose();
    recorder.dispose();
  }
}

/**
 * Synchronous compatibility path used by Web and focused unit tests. Native
 * sustained turning uses page-capture-rasterizer.native.ts instead.
 */
export function rasterizeRecordedPageCapture(
  recording: RecordedPageCapture,
): CapturedPage | null {
  const surface =
    Platform.OS === "web"
      ? Skia.Surface.Make(recording.pixelWidth, recording.pixelHeight)
      : Skia.Surface.MakeOffscreen(recording.pixelWidth, recording.pixelHeight);
  if (!surface) {
    return null;
  }
  let returnedCapture = false;
  let surfaceDisposed = false;
  try {
    const canvas = surface.getCanvas();
    canvas.drawPicture(recording.picture);
    surface.flush();
    const textureImage = surface.makeImageSnapshot();
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
    returnedCapture = true;
    return capturedPageFromImage(
      image,
      recording,
      surfaceDisposed ? null : surface,
    );
  } catch (error) {
    console.warn(
      "[Persimmon] Page rasterization failed; skipping the textured page turn.",
      error,
    );
    return null;
  } finally {
    if (!returnedCapture && !surfaceDisposed) {
      surface.dispose();
    }
  }
}

export function capturedPageFromImage(
  image: SkImage,
  dimensions: Pick<
    RecordedPageCapture,
    "scale" | "pixelWidth" | "pixelHeight" | "byteSize"
  >,
  retainedSurface: { dispose(): void } | null = null,
): CapturedPage {
  let retainedImage: SkImage | null = image;
  let surface = retainedSurface;
  let disposed = false;
  return {
    get image() {
      if (!retainedImage) {
        throw new Error("Captured page was accessed after owner release.");
      }
      return retainedImage;
    },
    scale: dimensions.scale,
    pixelWidth: dimensions.pixelWidth,
    pixelHeight: dimensions.pixelHeight,
    byteSize: dimensions.byteSize,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      const imageToRelease = retainedImage;
      const surfaceToRelease = surface;
      retainedImage = null;
      surface = null;
      releaseCapturedPageResources(
        Platform.OS,
        imageToRelease,
        surfaceToRelease,
      );
    },
  };
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
