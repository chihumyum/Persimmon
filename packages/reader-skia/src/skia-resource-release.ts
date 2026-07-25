interface DisposableSkiaResource {
  dispose(): void;
}

/**
 * Native declarative Skia may retain a HostObject in a display list after the
 * React owner releases it. Let JSI garbage collection reclaim that object once
 * Skia drops its final reference; calling dispose() early creates a use-after-
 * dispose race. CanvasKit does not have that HostObject ownership path, so Web
 * resources remain explicitly disposable.
 */
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
