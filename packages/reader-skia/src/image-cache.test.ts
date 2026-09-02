import { describe, expect, it, vi } from "vitest";

import { DecodedImageCache } from "./image-cache";

vi.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Data: {
      fromBytes: (bytes: Uint8Array) => ({ bytes, dispose: vi.fn() }),
    },
    Image: {
      // Decoded size follows the encoded length so tests can steer how many
      // bytes each installed image costs against the cache budget.
      MakeImageFromEncoded: (data: { bytes: Uint8Array }) => ({
        width: () => data.bytes.length,
        height: () => 1,
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

describe("decoded image cache pinning", () => {
  // A cover-heavy book: each pinned page image decodes to more than a third of
  // the budget, so the pinned set alone overflows it.
  const decodedBytesPerImage = 400;
  const encodedLength = decodedBytesPerImage / 4;
  const loader = async () => new Uint8Array(encodedLength);

  it("keeps images resident when pinned before their load finishes", async () => {
    const cache = new DecodedImageCache(1000);
    const pinned = new Set(["page-1", "page-2", "page-3"]);
    cache.pinOnly(pinned);

    await Promise.all(
      [...pinned].map((assetId) => cache.load(assetId, loader)),
    );

    for (const assetId of pinned) {
      expect(cache.getStatus(assetId)).toBe("ready");
      expect(cache.get(assetId)).toBeDefined();
    }
    expect(cache.sizeInBytes).toBe(3 * decodedBytesPerImage);
  });

  it("still evicts unpinned images to make room", async () => {
    const cache = new DecodedImageCache(1000);
    cache.pinOnly(new Set(["page-1", "page-2"]));
    await cache.load("stale", loader);
    await cache.load("page-1", loader);
    await cache.load("page-2", loader);

    expect(cache.getStatus("stale")).toBe("unrequested");
    expect(cache.getStatus("page-1")).toBe("ready");
    expect(cache.getStatus("page-2")).toBe("ready");
    expect(cache.sizeInBytes).toBe(2 * decodedBytesPerImage);
  });

  it("installs a load that finishes after the pinned set moved on as unpinned", async () => {
    const cache = new DecodedImageCache(1000);
    let finishLoad: ((bytes: Uint8Array) => void) | undefined;
    const slowLoader = () =>
      new Promise<Uint8Array>((resolve) => {
        finishLoad = resolve;
      });

    cache.pinOnly(new Set(["old"]));
    const pending = cache.load("old", slowLoader);
    cache.pinOnly(new Set(["page-1", "page-2"]));
    await Promise.resolve();
    finishLoad?.(new Uint8Array(encodedLength));
    await pending;
    await cache.load("page-1", loader);
    await cache.load("page-2", loader);

    expect(cache.getStatus("old")).toBe("unrequested");
    expect(cache.getStatus("page-1")).toBe("ready");
    expect(cache.getStatus("page-2")).toBe("ready");
  });
});
