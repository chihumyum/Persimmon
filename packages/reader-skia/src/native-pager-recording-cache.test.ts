import { describe, expect, it, vi } from "vitest";

import { NativePagerRecordingCache } from "./native-pager-recording-cache";

function recording(name: string, byteSize = 1) {
  return {
    name,
    byteSize,
    dispose: vi.fn(),
  };
}

describe("NativePagerRecordingCache", () => {
  it("reuses a recording and refreshes its LRU age", () => {
    const cache = new NativePagerRecordingCache<ReturnType<typeof recording>>(
      2,
      10,
    );
    const first = recording("first");
    const second = recording("second");
    const third = recording("third");
    const recreateFirst = vi.fn(() => recording("replacement"));

    expect(cache.getOrCreate("first", () => first)).toBe(first);
    cache.getOrCreate("second", () => second);
    expect(cache.getOrCreate("first", recreateFirst)).toBe(first);
    cache.getOrCreate("third", () => third);

    expect(recreateFirst).not.toHaveBeenCalled();
    expect(first.dispose).not.toHaveBeenCalled();
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
  });

  it("does not retain a failed recording", () => {
    const cache = new NativePagerRecordingCache<ReturnType<typeof recording>>(
      1,
      10,
    );
    const retry = recording("retry");

    expect(cache.getOrCreate("page", () => null)).toBeNull();
    expect(cache.getOrCreate("page", () => retry)).toBe(retry);
    expect(cache.size).toBe(1);
  });

  it("disposes every retained recording exactly once when cleared", () => {
    const cache = new NativePagerRecordingCache<ReturnType<typeof recording>>(
      2,
      10,
    );
    const first = recording("first");
    const second = recording("second");
    cache.getOrCreate("first", () => first);
    cache.getOrCreate("second", () => second);

    cache.clear();
    cache.clear();

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(cache.size).toBe(0);
    expect(cache.byteSize).toBe(0);
  });

  it("evicts by byte budget even when the entry limit has room", () => {
    const cache = new NativePagerRecordingCache<ReturnType<typeof recording>>(
      4,
      10,
    );
    const first = recording("first", 6);
    const second = recording("second", 6);

    cache.getOrCreate("first", () => first);
    cache.getOrCreate("second", () => second);

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).not.toHaveBeenCalled();
    expect(cache.size).toBe(1);
    expect(cache.byteSize).toBe(6);
  });

  it("retains one oversize recording for the native handoff", () => {
    const cache = new NativePagerRecordingCache<ReturnType<typeof recording>>(
      4,
      10,
    );
    const oversize = recording("oversize", 12);

    expect(cache.getOrCreate("oversize", () => oversize)).toBe(oversize);

    expect(oversize.dispose).not.toHaveBeenCalled();
    expect(cache.size).toBe(1);
    expect(cache.byteSize).toBe(12);
  });

  it("rejects an invalid capacity", () => {
    expect(() => new NativePagerRecordingCache(0, 1)).toThrow(RangeError);
    expect(() => new NativePagerRecordingCache(1.5, 1)).toThrow(RangeError);
    expect(() => new NativePagerRecordingCache(1, 0)).toThrow(RangeError);
    expect(() => new NativePagerRecordingCache(1, 1.5)).toThrow(RangeError);
  });
});
