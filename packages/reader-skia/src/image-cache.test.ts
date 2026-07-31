import { describe, expect, it, vi } from "vitest";

import { DecodedImageCache } from "./image-cache";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Data: {
      fromBytes: () => ({ dispose: vi.fn() }),
    },
    Image: {
      MakeImageFromEncoded: () => ({
        width: () => 4,
        height: () => 8,
      }),
    },
  },
}));

describe("decoded image cache state", () => {
  it("distinguishes loading from a settled unavailable resource", async () => {
    const cache = new DecodedImageCache(1024);
    let finishLoad: ((bytes: Uint8Array | undefined) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<Uint8Array | undefined>((resolve) => {
          finishLoad = resolve;
        }),
    );

    expect(cache.getStatus("cover")).toBe("unrequested");
    expect(cache.revision).toBe(0);
    const pending = cache.load("cover", loader);
    expect(cache.getStatus("cover")).toBe("loading");

    await Promise.resolve();
    finishLoad?.(undefined);
    await expect(pending).resolves.toBeNull();
    expect(cache.getStatus("cover")).toBe("unavailable");

    await expect(cache.load("cover", loader)).resolves.toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);

    cache.dispose();
    expect(cache.getStatus("cover")).toBe("unrequested");
    expect(cache.revision).toBe(0);
  });

  it("advances its revision once per installed image, not per cache hit", async () => {
    const cache = new DecodedImageCache(1024);
    const loader = vi.fn(async () => new Uint8Array([1, 2, 3]));

    const first = await cache.load("cover", loader);
    expect(first).not.toBeNull();
    expect(cache.revision).toBe(1);

    await expect(cache.load("cover", loader)).resolves.toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.revision).toBe(1);
  });
});
