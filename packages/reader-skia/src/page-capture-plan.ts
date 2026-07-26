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
 * The current view and its immediate neighbors are prefetch candidates. Views
 * two steps away are background-quality candidates. Clamped navigation and
 * short final spreads may expose the same physical page more than once; the
 * first stable position is retained while its highest-priority role wins.
 */
export function buildPageCapturePlan({
  settled,
  adjacent,
  addressesForView,
}: PageCapturePlanInput): readonly PageCapturePlanEntry[] {
  const previous = adjacent(settled, -1);
  const next = adjacent(settled, 1);
  const viewPlans: readonly ViewPlan[] = [
    { start: settled, role: "current", tier: "prefetch" },
    { start: previous, role: "neighbor", tier: "prefetch" },
    { start: next, role: "neighbor", tier: "prefetch" },
    {
      start: adjacent(previous, -1),
      role: "background",
      tier: "background",
    },
    {
      start: adjacent(next, 1),
      role: "background",
      tier: "background",
    },
  ];
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
