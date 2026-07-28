import { describe, expect, it, vi } from "vitest";

import {
  releaseCapturedPageResources,
  releaseSkiaResources,
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

  it("explicitly releases CanvasKit resources on Web", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseCapturedPageResources("web", image, surface);

    expect(image.dispose).toHaveBeenCalledOnce();
    expect(surface.dispose).toHaveBeenCalledOnce();
  });
});
