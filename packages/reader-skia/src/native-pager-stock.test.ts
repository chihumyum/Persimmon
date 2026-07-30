import { describe, expect, it } from "vitest";

import {
  buildNativePagerStockPlan,
  NATIVE_PAGER_STOCK_RADIUS,
  nativePagerPageKey,
  nativePagerTransitionPictures,
  trimNativePagerReconciliationEntries,
} from "./native-pager-stock";
import type { PageAddress } from "./section-navigation";

function page(pageIndex: number): PageAddress {
  return { sectionIndex: 0, pageIndex };
}

function adjacentFor(pageCount: number) {
  return (address: PageAddress, direction: 1 | -1): PageAddress =>
    page(Math.max(0, Math.min(pageCount - 1, address.pageIndex + direction)));
}

describe("native pager picture stock", () => {
  it("maps all four physical page roles for a forward spread", () => {
    expect(
      nativePagerTransitionPictures(
        "spread",
        1,
        [page(2), page(3)],
        [page(4), page(5)],
      ),
    ).toEqual({
      faces: { front: page(3), back: page(4) },
      backgroundLeft: page(2),
      backgroundRight: page(5),
    });
  });

  it("mirrors spread faces while preserving the stationary outer pages", () => {
    expect(
      nativePagerTransitionPictures(
        "spread",
        -1,
        [page(4), page(5)],
        [page(2), page(3)],
      ),
    ).toEqual({
      faces: { front: page(3), back: page(4) },
      backgroundLeft: page(2),
      backgroundRight: page(5),
    });
  });

  it("allows an intentionally blank outer slot at a spread boundary", () => {
    expect(
      nativePagerTransitionPictures(
        "spread",
        -1,
        [page(4)],
        [page(2), page(3)],
      ),
    ).toEqual({
      faces: { front: page(3), back: page(4) },
      backgroundLeft: page(2),
      backgroundRight: undefined,
    });
  });

  it("evicts distant reconciliation records before old reverse runway", () => {
    const entries = new Map(
      Array.from({ length: 130 }, (_, index) => [`edge:${index}`, index]),
    );

    trimNativePagerReconciliationEntries(
      entries,
      new Set(["edge:0", "edge:1"]),
      128,
    );

    expect(entries.size).toBe(128);
    expect(entries.has("edge:0")).toBe(true);
    expect(entries.has("edge:1")).toBe(true);
    expect(entries.has("edge:2")).toBe(false);
    expect(entries.has("edge:3")).toBe(false);
  });

  it("treats the live reconciliation radius as a soft lower bound", () => {
    const entries = new Map([
      ["edge:0", 0],
      ["edge:1", 1],
      ["edge:2", 2],
    ]);

    trimNativePagerReconciliationEntries(entries, new Set(entries.keys()), 2);

    expect([...entries.keys()]).toEqual(["edge:0", "edge:1", "edge:2"]);
  });

  it("builds reciprocal transitions around the acknowledged page", () => {
    const plan = buildNativePagerStockPlan(page(5), adjacentFor(20), 2);

    expect(
      plan.map((edge) => [
        edge.from.pageIndex,
        edge.to.pageIndex,
        edge.direction,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [5, 6, 1],
        [6, 5, -1],
        [5, 4, -1],
        [4, 5, 1],
        [6, 7, 1],
        [7, 6, -1],
        [4, 3, -1],
        [3, 4, 1],
      ]),
    );
    expect(plan).toHaveLength(8);
  });

  it("keeps eight transitions of runway in each direction by default", () => {
    const plan = buildNativePagerStockPlan(
      page(10),
      adjacentFor(21),
      NATIVE_PAGER_STOCK_RADIUS,
    );

    expect(Math.max(...plan.map((edge) => edge.distance))).toBe(8);
    expect(plan).toHaveLength(NATIVE_PAGER_STOCK_RADIUS * 4);
  });

  it("stops cleanly at publication boundaries without duplicate edges", () => {
    const plan = buildNativePagerStockPlan(page(0), adjacentFor(3), 12);
    const keys = plan.map(
      (edge) => `${nativePagerPageKey(edge.from)}:${edge.direction}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
    expect(
      plan.map((edge) => [
        edge.from.pageIndex,
        edge.to.pageIndex,
        edge.direction,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [0, 1, 1],
        [1, 0, -1],
        [1, 2, 1],
        [2, 1, -1],
      ]),
    );
    expect(plan).toHaveLength(4);
  });

  it("prioritizes the two transitions touching the anchor", () => {
    const plan = buildNativePagerStockPlan(page(5), adjacentFor(20), 3);

    expect(
      plan.slice(0, 2).map((edge) => [edge.from.pageIndex, edge.direction]),
    ).toEqual([
      [5, 1],
      [5, -1],
    ]);
    expect(plan.slice(0, 4).every((edge) => edge.distance === 1)).toBe(true);
    expect(plan.slice(4).every((edge) => edge.distance >= 2)).toBe(true);
  });
});
