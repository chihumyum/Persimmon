import { describe, expect, it, vi } from "vitest";

import {
  releaseCapturedPageResources,
  releaseRetiredSkiaResources,
  releaseSkiaResources,
  releaseTransientSkiaResources,
} from "./skia-resource-release";

describe("captured page resource ownership", () => {
  it("releases Android CPU images after the paint grace period", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseCapturedPageResources("android", image, surface);

    expect(image.dispose).toHaveBeenCalledOnce();
    expect(surface.dispose).not.toHaveBeenCalled();
  });

  it("keeps other Android Skia resources under native GC ownership", () => {
    const resource = { dispose: vi.fn() };

    releaseSkiaResources("android", resource, null);

    expect(resource.dispose).not.toHaveBeenCalled();
  });

  it("keeps iOS resources under their native GC ownership path", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseCapturedPageResources("ios", image, surface);

    expect(image.dispose).not.toHaveBeenCalled();
    expect(surface.dispose).not.toHaveBeenCalled();
  });

  it("releases never-rendered measurement resources on every platform", () => {
    const paragraph = { dispose: vi.fn() };

    releaseTransientSkiaResources(paragraph);

    expect(paragraph.dispose).toHaveBeenCalledOnce();
  });

  it("releases an entire generation after its Canvas has retired", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseRetiredSkiaResources(image, surface);

    expect(image.dispose).toHaveBeenCalledOnce();
    expect(surface.dispose).toHaveBeenCalledOnce();
  });

  it("explicitly releases CanvasKit resources on Web", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseCapturedPageResources("web", image, surface);

    expect(image.dispose).toHaveBeenCalledOnce();
    expect(surface.dispose).toHaveBeenCalledOnce();
  });
});
