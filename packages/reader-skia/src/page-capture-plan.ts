import type { PageAddress } from "./section-navigation";

export type PageCapturePlanRole = "current" | "neighbor" | "background";
export type PageCapturePlanTier = "prefetch" | "background";

export interface PageCapturePlanEntry {
  readonly address: PageAddress;
  readonly viewStart: PageAddress;
  readonly slot: number;
  readonly role: PageCapturePlanRole;
  readonly tier: PageCapturePlanTier;
}

export interface PageCapturePlanInput {
  readonly settled: PageAddress;
  readonly adjacent: (address: PageAddress, direction: 1 | -1) => PageAddress;
  readonly addressesForView: (
    address: PageAddress,
  ) => readonly (PageAddress | undefined)[];
  /**
   * Number of views retained on each side while direction is still unknown.
   * The caller should derive this from its byte budget.
   */
  readonly radius?: number;
}

interface ViewPlan {
  readonly start: PageAddress;
  readonly role: PageCapturePlanRole;
  readonly tier: PageCapturePlanTier;
}

const ROLE_PRIORITY: Readonly<Record<PageCapturePlanRole, number>> = {
  current: 2,
  neighbor: 1,
  background: 0,
};

/**
 * Plans a small physical-page capture window independently of animation lanes.
 *
 * The current view and its immediate neighbors are prefetch candidates. More
 * distant views are background candidates. Clamped navigation and short final
 * spreads may expose the same physical page more than once; the first stable
 * position is retained while its highest-priority role wins.
 */
export function buildPageCapturePlan({
  settled,
  adjacent,
  addressesForView,
  radius = 2,
}: PageCapturePlanInput): readonly PageCapturePlanEntry[] {
  const retainedRadius = Math.max(1, Math.floor(radius));
  const viewPlans: ViewPlan[] = [
    { start: settled, role: "current", tier: "prefetch" },
  ];
  let previous = settled;
  let next = settled;
  for (let distance = 1; distance <= retainedRadius; distance += 1) {
    previous = adjacent(previous, -1);
    next = adjacent(next, 1);
    const role = distance === 1 ? "neighbor" : "background";
    const tier = distance === 1 ? "prefetch" : "background";
    viewPlans.push(
      { start: previous, role, tier },
      { start: next, role, tier },
    );
  }
  const entries = new Map<string, PageCapturePlanEntry>();

  for (const view of viewPlans) {
    for (const [slot, address] of addressesForView(view.start).entries()) {
      if (!address) {
        continue;
      }
      const key = pageAddressKey(address);
      const existing = entries.get(key);
      if (
        !existing ||
        ROLE_PRIORITY[view.role] > ROLE_PRIORITY[existing.role]
      ) {
        entries.set(key, {
          address,
          viewStart: view.start,
          slot,
          role: view.role,
          tier: view.tier,
        });
      }
    }
  }

  return [...entries.values()];
}

function pageAddressKey(address: PageAddress): string {
  return `${address.sectionIndex}:${address.pageIndex}`;
}
