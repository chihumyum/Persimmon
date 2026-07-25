import { describe, expect, it } from "vitest";

import {
  adjacentPageAddress,
  adjacentViewAddress,
  comparePageAddresses,
  pageAddressesFrom,
} from "./section-navigation";

const PAGE_COUNTS = [2, 3, 1];
const pageCount = (sectionIndex: number) => PAGE_COUNTS[sectionIndex]!;

describe("section page navigation", () => {
  it("crosses section boundaries in both directions", () => {
    expect(
      adjacentPageAddress(
        { sectionIndex: 0, pageIndex: 1 },
        1,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 1, pageIndex: 0 });
    expect(
      adjacentPageAddress(
        { sectionIndex: 1, pageIndex: 0 },
        -1,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 0, pageIndex: 1 });
  });

  it("clamps at the start and end of the publication", () => {
    expect(
      adjacentPageAddress(
        { sectionIndex: 0, pageIndex: 0 },
        -1,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 0, pageIndex: 0 });
    expect(
      adjacentPageAddress(
        { sectionIndex: 2, pageIndex: 0 },
        1,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 2, pageIndex: 0 });
  });

  it("orders addresses by section and then local page", () => {
    expect(
      comparePageAddresses(
        { sectionIndex: 1, pageIndex: 0 },
        { sectionIndex: 0, pageIndex: 99 },
      ),
    ).toBeGreaterThan(0);
  });

  it("builds a spread across a section boundary", () => {
    expect(
      pageAddressesFrom(
        { sectionIndex: 0, pageIndex: 1 },
        2,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual([
      { sectionIndex: 0, pageIndex: 1 },
      { sectionIndex: 1, pageIndex: 0 },
    ]);
  });

  it("moves by a complete spread without repeating the visible right page", () => {
    expect(
      adjacentViewAddress(
        { sectionIndex: 0, pageIndex: 0 },
        1,
        2,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 1, pageIndex: 0 });
    expect(
      adjacentViewAddress(
        { sectionIndex: 2, pageIndex: 0 },
        -1,
        2,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 1, pageIndex: 1 });
    expect(
      adjacentViewAddress(
        { sectionIndex: 1, pageIndex: 2 },
        1,
        2,
        PAGE_COUNTS.length,
        pageCount,
      ),
    ).toEqual({ sectionIndex: 1, pageIndex: 2 });
  });
});
