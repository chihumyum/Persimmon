import { describe, expect, it, vi } from "vitest";

import { SectionPageCountCache } from "./section-page-count-cache";

describe("SectionPageCountCache", () => {
  it("counts an unretained section once and caches only its page count", () => {
    const countUnretainedSection = vi.fn(() => 7);
    const cache = new SectionPageCountCache({
      retainedPageCountFor: () => undefined,
      countUnretainedSection,
    });

    expect(cache.countFor(3)).toBe(7);
    expect(cache.countFor(3)).toBe(7);
    expect(countUnretainedSection).toHaveBeenCalledTimes(1);
  });

  it("uses retained visible pagination without recounting the section", () => {
    const countUnretainedSection = vi.fn(() => 9);
    const cache = new SectionPageCountCache({
      retainedPageCountFor: () => 4,
      countUnretainedSection,
    });

    expect(cache.countFor(0)).toBe(4);
    expect(countUnretainedSection).not.toHaveBeenCalled();
  });

  it("keeps a resolved count after its retained pagination is evicted", () => {
    let retainedPageCount: number | undefined = 7;
    const cache = new SectionPageCountCache({
      retainedPageCountFor: () => retainedPageCount,
      countUnretainedSection: () => 11,
    });

    expect(cache.resolvedCountFor(2)).toBe(7);
    retainedPageCount = undefined;
    expect(cache.resolvedCountFor(2)).toBe(7);
  });

  it("normalizes an empty section to one page", () => {
    const cache = new SectionPageCountCache({
      retainedPageCountFor: () => undefined,
      countUnretainedSection: () => 0,
    });

    expect(cache.countFor(0)).toBe(1);
  });
});
