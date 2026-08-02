import { describe, expect, it, vi } from "vitest";

import { LibraryCoverCache, libraryCoverCacheKey } from "./library-cover-cache";

describe("LibraryCoverCache", () => {
  it("reuses a prepared cover and its measured ratio after the shelf remounts", async () => {
    const cache = new LibraryCoverCache();
    const key = libraryCoverCacheKey("book", "cover", "image/png");
    const readBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));

    const loaded = await cache.load(key, "image/png", readBytes);
    cache.rememberRatio(key, 0.625);
    const remounted = cache.peek(key);

    expect(loaded?.uri).toBe("data:image/png;base64,AQID");
    expect(remounted).toEqual({
      ratio: 0.625,
      uri: "data:image/png;base64,AQID",
    });
    await expect(cache.load(key, "image/png", readBytes)).resolves.toEqual(
      remounted,
    );
    expect(readBytes).toHaveBeenCalledTimes(1);
  });

  it("lets an in-flight cover load finish once after its component unmounts", async () => {
    const cache = new LibraryCoverCache();
    const key = libraryCoverCacheKey("book", "cover", "image/jpeg");
    let finishRead!: (bytes: Uint8Array) => void;
    const readBytes = vi.fn(
      () =>
        new Promise<Uint8Array>((resolve) => {
          finishRead = resolve;
        }),
    );

    const firstLoad = cache.load(key, "image/jpeg", readBytes);
    const remountedLoad = cache.load(key, "image/jpeg", readBytes);
    finishRead(new Uint8Array([4, 5, 6]));

    await expect(Promise.all([firstLoad, remountedLoad])).resolves.toEqual([
      { uri: "data:image/jpeg;base64,BAUG" },
      { uri: "data:image/jpeg;base64,BAUG" },
    ]);
    expect(readBytes).toHaveBeenCalledTimes(1);
  });

  it("bounds retained cover memory with least-recently-used eviction", async () => {
    const cache = new LibraryCoverCache({ maxBytes: 1_000, maxEntries: 2 });
    const firstKey = libraryCoverCacheKey("first", "cover", "image/png");
    const secondKey = libraryCoverCacheKey("second", "cover", "image/png");
    const thirdKey = libraryCoverCacheKey("third", "cover", "image/png");
    const bytes = new Uint8Array([1]);

    await cache.load(firstKey, "image/png", async () => bytes);
    await cache.load(secondKey, "image/png", async () => bytes);
    await cache.load(firstKey, "image/png", async () => bytes);
    await cache.load(thirdKey, "image/png", async () => bytes);

    expect(cache.peek(firstKey)).toBeDefined();
    expect(cache.peek(secondKey)).toBeUndefined();
    expect(cache.peek(thirdKey)).toBeDefined();
    expect(cache.entryCount).toBe(2);
    expect(cache.estimatedByteLength).toBeLessThanOrEqual(1_000);
  });
});
