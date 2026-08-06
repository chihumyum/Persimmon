import { describe, expect, it, vi } from "vitest";

import {
  releaseCapturedPageResources,
  releaseRetiredSkiaResources,
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

  it("keeps retired iOS resources alive for native display-list ownership", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseRetiredSkiaResources("ios", image, surface);

    expect(image.dispose).not.toHaveBeenCalled();
    expect(surface.dispose).not.toHaveBeenCalled();
  });

  it("releases an entire retired generation on other platforms", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseRetiredSkiaResources("android", image, surface);

    expect(image.dispose).toHaveBeenCalledOnce();
    expect(surface.dispose).toHaveBeenCalledOnce();
  });
});
