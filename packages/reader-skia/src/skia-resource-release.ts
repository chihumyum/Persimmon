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
 * Resources created only for synchronous measurement are never submitted to a
 * declarative Canvas or native pager. They have no replaying display-list
 * owner, so keeping them on native GC ownership only turns every exact page
 * count into a large burst of pending JSI finalizers.
 */
export function releaseTransientSkiaResources(
  resource: DisposableSkiaResource | null,
  secondary: DisposableSkiaResource | null = null,
): void {
  resource?.dispose();
  secondary?.dispose();
}

/**
 * A retired render generation has already been removed from React and given
 * two paint opportunities to drain Skia's previous display list. At that
 * point no platform may still replay these owners, so their native handles can
 * be released deterministically instead of waiting for a memory-pressure GC.
 */
export function releaseRetiredSkiaResources(
  resource: DisposableSkiaResource | null,
  secondary: DisposableSkiaResource | null = null,
): void {
  resource?.dispose();
  secondary?.dispose();
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
