import { describe, expect, it, vi } from "vitest";

import { releaseSkiaResources } from "./skia-resource-release";

describe("captured page resource ownership", () => {
  it("lets native JSI release images after the display list drops them", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseSkiaResources("android", image, surface);
    releaseSkiaResources("ios", image, surface);

    expect(image.dispose).not.toHaveBeenCalled();
    expect(surface.dispose).not.toHaveBeenCalled();
  });

  it("explicitly releases CanvasKit resources on Web", () => {
    const image = { dispose: vi.fn() };
    const surface = { dispose: vi.fn() };

    releaseSkiaResources("web", image, surface);

    expect(image.dispose).toHaveBeenCalledOnce();
    expect(surface.dispose).toHaveBeenCalledOnce();
  });
});
