import { describe, expect, it, vi } from "vitest";

import { SkiaParagraphHandleCache } from "./skia-paragraph-handle-cache";

interface FakeHandle {
  readonly id: string;
  dispose(): void;
}

function handle(id: string): FakeHandle {
  return { id, dispose: vi.fn() };
}

describe("SkiaParagraphHandleCache", () => {
  it("reuses a retained handle and refreshes its LRU position", () => {
    const retired: string[] = [];
    const cache = new SkiaParagraphHandleCache<FakeHandle>(2, (value) => {
      retired.push(value.id);
    });
    const first = cache.getOrCreate("first", () => handle("first"));
    cache.getOrCreate("second", () => handle("second"));

    expect(cache.getOrCreate("first", () => handle("replacement"))).toBe(first);
    cache.getOrCreate("third", () => handle("third"));

    expect(retired).toEqual(["second"]);
    expect(cache.size).toBe(2);
  });

  it("retires only materialized entries", () => {
    const retired: string[] = [];
    const cache = new SkiaParagraphHandleCache<FakeHandle>(2, (value) => {
      retired.push(value.id);
    });
    cache.getOrCreate("first", () => handle("first"));

    cache.release("missing");
    cache.release("first");
    cache.release("first");

    expect(retired).toEqual(["first"]);
    expect(cache.size).toBe(0);
  });

  it("detaches the complete cache before retiring its handles", () => {
    const observedSizes: number[] = [];
    const cache = new SkiaParagraphHandleCache<FakeHandle>(2, () => {
      observedSizes.push(cache.size);
    });
    cache.getOrCreate("first", () => handle("first"));
    cache.getOrCreate("second", () => handle("second"));

    cache.clear();

    expect(observedSizes).toEqual([0, 0]);
    expect(cache.size).toBe(0);
  });

  it("rejects a non-positive capacity", () => {
    expect(() => new SkiaParagraphHandleCache(0, () => {})).toThrow(
      "maximumEntries must be a positive integer",
    );
  });
});
