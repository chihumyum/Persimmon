interface DisposableSkiaResource {
  dispose(): void;
}

export function releaseSkiaResources(
  platform: string,
  image: DisposableSkiaResource | null,
  surface: DisposableSkiaResource | null,
): void {
  if (platform !== "web") {
    return;
  }
  image?.dispose();
  surface?.dispose();
}

/**
 * Android page captures are CPU SkImages created on dedicated raster runtimes.
 * Their native pager and display-list consumers copy the underlying sk_sp, so
 * releasing the JSI owner's image reference after the paint grace period is
 * safe. Paragraphs and other native Skia resources keep GC ownership.
 */
export function releaseCapturedPageResources(
  platform: string,
  image: DisposableSkiaResource | null,
  surface: DisposableSkiaResource | null,
): void {
  if (platform === "android") {
    image?.dispose();
    return;
  }
  releaseSkiaResources(platform, image, surface);
}
