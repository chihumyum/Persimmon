import { samePageAddress, type PageAddress } from "./section-navigation";
import { pageTurnBackgroundSlots } from "./page-turn-background";
import {
  pageTurnCaptureAddresses,
  type PageTurnCaptureAddresses,
} from "./page-turn-textures";

// Eight transitions give the native compositor an 800 ms runway at 10 pps.
// Reconciliation refills one edge at a time as native acknowledges turns, so
// a wider eager radius only retains more full-page SkPictures without
// increasing the sustainable consumption rate.
export const NATIVE_PAGER_STOCK_RADIUS = 8;

export interface NativePagerStockEdge {
  readonly from: PageAddress;
  readonly to: PageAddress;
  readonly direction: 1 | -1;
  readonly distance: number;
}

export interface NativePagerTransitionPictures<T> {
  readonly faces: PageTurnCaptureAddresses<T>;
  readonly backgroundLeft?: T;
  readonly backgroundRight?: T;
}

export function nativePagerTransitionPictures<T>(
  layout: "single" | "spread",
  direction: 1 | -1,
  current: readonly (T | undefined)[],
  target: readonly (T | undefined)[],
): NativePagerTransitionPictures<T> {
  const backgrounds = pageTurnBackgroundSlots(
    layout,
    direction,
    current,
    target,
  );
  return {
    faces: pageTurnCaptureAddresses(layout, direction, current, target),
    backgroundLeft: backgrounds[0],
    backgroundRight: layout === "spread" ? backgrounds[1] : undefined,
  };
}

export function nativePagerPageKey(address: PageAddress): string {
  return `${address.sectionIndex}:${address.pageIndex}`;
}

/**
 * Keeps the asynchronous RN reconciliation table aligned with the native
 * compositor's distance-based stock eviction.
 *
 * A plain insertion-order cap can discard an old-but-near reverse edge while
 * native intentionally keeps that edge. Its later `consumed` event would then
 * animate correctly but fail to advance Reader state. Entries in the current
 * stock plan therefore win over stale, distant entries regardless of age.
 */
export function trimNativePagerReconciliationEntries<T>(
  entries: Map<string, T>,
  retainedEntryIds: ReadonlySet<string>,
  maximumEntries: number,
): void {
  const limit = Math.max(0, Math.floor(maximumEntries));
  while (entries.size > limit) {
    let distantEntryId: string | undefined;
    for (const entryId of entries.keys()) {
      if (!retainedEntryIds.has(entryId)) {
        distantEntryId = entryId;
        break;
      }
    }
    if (distantEntryId === undefined) {
      // The live radius is a soft lower bound. It is safer to exceed the tiny
      // metadata cap than to lose the address for a native-consumed turn.
      return;
    }
    entries.delete(distantEntryId);
  }
}

/**
 * Builds a bidirectional transition graph around the acknowledged page.
 *
 * Entries are keyed by their source page and direction in native code. A
 * graph, rather than a FIFO, lets the compositor accept an immediate reverse
 * tap while RN is still reconciling an earlier native turn.
 */
export function buildNativePagerStockPlan(
  anchor: PageAddress,
  adjacent: (address: PageAddress, direction: 1 | -1) => PageAddress,
  radius = NATIVE_PAGER_STOCK_RADIUS,
): readonly NativePagerStockEdge[] {
  const retainedRadius = Math.max(1, Math.floor(radius));
  const addresses = new Map<string, PageAddress>();
  const signedDistances = new Map<string, number>();
  const anchorKey = nativePagerPageKey(anchor);
  addresses.set(anchorKey, anchor);
  signedDistances.set(anchorKey, 0);

  for (const direction of [-1, 1] as const) {
    let current = anchor;
    for (let distance = 1; distance <= retainedRadius; distance += 1) {
      const next = adjacent(current, direction);
      if (samePageAddress(next, current)) {
        break;
      }
      const key = nativePagerPageKey(next);
      addresses.set(key, next);
      signedDistances.set(key, distance * direction);
      current = next;
    }
  }

  const edges = new Map<string, NativePagerStockEdge>();
  for (const [fromKey, from] of addresses) {
    for (const direction of [-1, 1] as const) {
      const to = adjacent(from, direction);
      const toKey = nativePagerPageKey(to);
      if (
        samePageAddress(from, to) ||
        !addresses.has(toKey) ||
        !signedDistances.has(fromKey) ||
        !signedDistances.has(toKey)
      ) {
        continue;
      }
      edges.set(`${fromKey}:${direction}`, {
        from,
        to,
        direction,
        distance: Math.max(
          Math.abs(signedDistances.get(fromKey)!),
          Math.abs(signedDistances.get(toKey)!),
        ),
      });
    }
  }

  return [...edges.values()].sort(
    (left, right) =>
      left.distance - right.distance ||
      Number(!samePageAddress(left.from, anchor)) -
        Number(!samePageAddress(right.from, anchor)) ||
      Math.abs(left.direction - 1) - Math.abs(right.direction - 1),
  );
}
