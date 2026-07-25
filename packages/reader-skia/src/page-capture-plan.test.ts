import { describe, expect, it } from "vitest";

import { buildPageCapturePlan } from "./page-capture-plan";
import type { PageAddress } from "./section-navigation";

function page(pageIndex: number, sectionIndex = 0): PageAddress {
  return { sectionIndex, pageIndex };
}

describe("page capture plan", () => {
  it("plans a stable five-page window for a single-page view", () => {
    const plan = buildPageCapturePlan({
      settled: page(2),
      adjacent: (address, direction) =>
        page(address.pageIndex + direction, address.sectionIndex),
      addressesForView: (address) => [address],
    });

    expect(plan).toEqual([
      { address: page(2), role: "current", tier: "prefetch" },
      { address: page(1), role: "neighbor", tier: "prefetch" },
      { address: page(3), role: "neighbor", tier: "prefetch" },
      { address: page(0), role: "background", tier: "background" },
      { address: page(4), role: "background", tier: "background" },
    ]);
  });

  it("expands each planned view into both physical pages of a spread", () => {
    const plan = buildPageCapturePlan({
      settled: page(4),
      adjacent: (address, direction) =>
        page(address.pageIndex + direction * 2, address.sectionIndex),
      addressesForView: (address) => [
        address,
        page(address.pageIndex + 1, address.sectionIndex),
      ],
    });

    expect(plan).toEqual([
      { address: page(4), role: "current", tier: "prefetch" },
      { address: page(5), role: "current", tier: "prefetch" },
      { address: page(2), role: "neighbor", tier: "prefetch" },
      { address: page(3), role: "neighbor", tier: "prefetch" },
      { address: page(6), role: "neighbor", tier: "prefetch" },
      { address: page(7), role: "neighbor", tier: "prefetch" },
      { address: page(0), role: "background", tier: "background" },
      { address: page(1), role: "background", tier: "background" },
      { address: page(8), role: "background", tier: "background" },
      { address: page(9), role: "background", tier: "background" },
    ]);
  });

  it("deduplicates clamped views while retaining the highest-priority role", () => {
    const plan = buildPageCapturePlan({
      settled: page(0),
      adjacent: (address, direction) =>
        page(Math.max(0, Math.min(2, address.pageIndex + direction))),
      addressesForView: (address) => [address],
    });

    expect(plan).toEqual([
      { address: page(0), role: "current", tier: "prefetch" },
      { address: page(1), role: "neighbor", tier: "prefetch" },
      { address: page(2), role: "background", tier: "background" },
    ]);
  });

  it("has a fixed two-view radius rather than scaling with lane capacity", () => {
    const visitedStarts: PageAddress[] = [];
    const plan = buildPageCapturePlan({
      settled: page(100),
      adjacent: (address, direction) =>
        page(address.pageIndex + direction, address.sectionIndex),
      addressesForView: (address) => {
        visitedStarts.push(address);
        return [address];
      },
    });

    expect(visitedStarts).toEqual([
      page(100),
      page(99),
      page(101),
      page(98),
      page(102),
    ]);
    expect(plan).toHaveLength(5);
  });
});
