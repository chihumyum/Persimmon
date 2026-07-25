import { describe, expect, it } from "vitest";

import { pageCapturePixelSize } from "./page-capture-budget";
import {
  CapturedPageCache,
  type CaptureFactory,
  type PageCaptureCacheValue,
  type PageCaptureIdentity,
} from "./page-capture-cache";

interface FakeMetadata {
  readonly pageIndex: number;
}

interface FakeCapture extends PageCaptureCacheValue {
  readonly id: string;
  disposed: boolean;
}

function page(
  key: string,
  width = 10,
  height = 10,
  pageIndex = 0,
): PageCaptureIdentity<FakeMetadata> {
  return { key, width, height, metadata: { pageIndex } };
}

function fakeCapture(
  identity: PageCaptureIdentity<FakeMetadata>,
  scale: number,
): FakeCapture {
  const size = pageCapturePixelSize(identity.width, identity.height, scale);
  if (!size) {
    throw new Error("invalid fake capture dimensions");
  }
  return {
    id: `${identity.key}@${scale}`,
    scale,
    pixelWidth: size.width,
    pixelHeight: size.height,
    byteSize: size.byteSize,
    disposed: false,
    dispose() {
      this.disposed = true;
    },
  };
}

function trackingFactory(
  captures: FakeCapture[],
  failKey?: string,
): CaptureFactory<FakeCapture, FakeMetadata> {
  return (identity, scale) => {
    if (identity.key === failKey) {
      return null;
    }
    const capture = fakeCapture(identity, scale);
    captures.push(capture);
    return capture;
  };
}

function cache(
  targetByteBudget: number,
  hardByteBudget = targetByteBudget,
): CapturedPageCache<FakeCapture, FakeMetadata> {
  return new CapturedPageCache({
    targetByteBudget,
    hardByteBudget,
  });
}

describe("captured page LRU", () => {
  it("accounts the actual rounded pixel dimensions", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(100_000);
    const value = capturesCache.prefetch(
      {
        identity: page("rounded", 101, 51),
        tier: "prefetch",
        desiredScale: 1.5,
      },
      trackingFactory(captures),
    );

    expect(value).toMatchObject({
      pixelWidth: 152,
      pixelHeight: 77,
      byteSize: 152 * 77 * 4,
    });
    expect(capturesCache.getStats().residentBytes).toBe(152 * 77 * 4);
  });

  it("rejects a factory value whose byte accounting is inaccurate", () => {
    const capturesCache = cache(10_000);
    const invalid = {
      ...fakeCapture(page("invalid"), 1),
      byteSize: 399,
    };

    expect(() =>
      capturesCache.prefetch(
        {
          identity: page("invalid"),
          tier: "prefetch",
          desiredScale: 1,
        },
        () => invalid,
      ),
    ).toThrow(/byteSize/);
    expect(invalid.disposed).toBe(true);
    expect(capturesCache.getStats()).toMatchObject({
      residentBytes: 0,
      entryCount: 0,
    });
  });

  it("reuses the closest sufficient variant and refreshes its LRU age", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(800);
    const a = page("a");
    const b = page("b");
    const c = page("c");
    const factory = trackingFactory(captures);
    const firstA = capturesCache.prefetch(
      { identity: a, tier: "background", desiredScale: 1 },
      factory,
    );
    const firstB = capturesCache.prefetch(
      { identity: b, tier: "background", desiredScale: 1 },
      factory,
    );
    const secondA = capturesCache.prefetch(
      { identity: a, tier: "background", desiredScale: 1 },
      factory,
    );
    capturesCache.prefetch(
      { identity: c, tier: "background", desiredScale: 1 },
      factory,
    );

    expect(secondA).toBe(firstA);
    expect(firstB?.disposed).toBe(true);
    expect(firstA?.disposed).toBe(false);
    expect(captures).toHaveLength(3);
  });

  it("reuses a passive variant when nominal scales round to the same pixels", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(100);
    const identity = page("rounded-passive", 1, 1);
    const factory = trackingFactory(captures);
    const first = capturesCache.prefetch(
      { identity, tier: "background", desiredScale: 1 },
      factory,
    );
    const second = capturesCache.prefetch(
      { identity, tier: "prefetch", desiredScale: 1.1 },
      factory,
    );

    expect(second).toBe(first);
    expect(captures).toHaveLength(1);
    expect(capturesCache.getStats()).toMatchObject({
      entryCount: 1,
      residentBytes: 4,
    });
  });

  it("evicts a newer background capture before an older prefetch capture", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(1_200);
    const factory = trackingFactory(captures);
    const prefetched = capturesCache.prefetch(
      {
        identity: page("prefetched"),
        tier: "prefetch",
        desiredScale: 1,
      },
      factory,
    );
    const background = capturesCache.prefetch(
      {
        identity: page("background"),
        tier: "background",
        desiredScale: 1,
      },
      factory,
    );

    const active = capturesCache.acquireTurn(
      {
        turnId: "turn",
        front: {
          identity: page("active", 10, 20),
          desiredScale: 1,
        },
      },
      factory,
    );

    expect(active.ok).toBe(true);
    expect(background?.disposed).toBe(true);
    expect(prefetched?.disposed).toBe(false);
  });

  it("reconciles stale unpinned prefetch entries back to background", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(800);
    const factory = trackingFactory(captures);
    const a = page("a");
    const b = page("b");
    const aCapture = capturesCache.prefetch(
      { identity: a, tier: "prefetch", desiredScale: 1 },
      factory,
    );
    capturesCache.prefetch(
      { identity: b, tier: "prefetch", desiredScale: 1 },
      factory,
    );
    capturesCache.prefetch(
      { identity: a, tier: "prefetch", desiredScale: 1 },
      factory,
    );
    capturesCache.reconcileUnpinnedTiers([{ identity: b, tier: "prefetch" }]);
    capturesCache.prefetch(
      { identity: page("c"), tier: "prefetch", desiredScale: 1 },
      factory,
    );

    expect(aCapture?.disposed).toBe(true);
  });
});

describe("captured page turn leases", () => {
  it("acquires front and back atomically and pins both", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(800);
    const result = capturesCache.acquireTurn(
      {
        turnId: "spread",
        front: { identity: page("front"), desiredScale: 1 },
        back: { identity: page("back"), desiredScale: 1 },
      },
      trackingFactory(captures),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.lease.front?.id).toBe("front@1");
    expect(result.lease.back?.id).toBe("back@1");
    expect(capturesCache.getStats()).toEqual({
      residentBytes: 800,
      pinnedBytes: 800,
      entryCount: 2,
      pinnedEntryCount: 2,
      leaseCount: 1,
    });
  });

  it("rolls back a partial two-face capture failure", () => {
    const captures: FakeCapture[] = [];
    const disposed: FakeCapture[] = [];
    const capturesCache = new CapturedPageCache<FakeCapture, FakeMetadata>({
      targetByteBudget: 800,
      hardByteBudget: 800,
      disposeValue(value) {
        value.dispose();
        disposed.push(value);
      },
    });
    const result = capturesCache.acquireTurn(
      {
        turnId: "failed",
        front: { identity: page("front"), desiredScale: 1 },
        back: { identity: page("back"), desiredScale: 1 },
      },
      trackingFactory(captures, "back"),
    );

    expect(result).toEqual({ ok: false, reason: "capture-failed" });
    expect(capturesCache.getStats()).toMatchObject({
      residentBytes: 0,
      entryCount: 0,
      leaseCount: 0,
    });
    expect(disposed.length).toBeGreaterThan(0);
    expect(disposed.every((value) => value.disposed)).toBe(true);
  });

  it("shares a pin-counted entry across independent turn leases", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(400, 800);
    const identity = page("shared");
    const factory = trackingFactory(captures);
    const first = capturesCache.acquireTurn(
      {
        turnId: "first",
        front: { identity, desiredScale: 1 },
      },
      factory,
    );
    const second = capturesCache.acquireTurn(
      {
        turnId: "second",
        front: { identity, desiredScale: 1 },
      },
      factory,
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    first.lease.release("drop");
    expect(first.lease.front?.disposed).toBe(false);
    expect(capturesCache.getStats()).toMatchObject({
      pinnedEntryCount: 1,
      leaseCount: 1,
    });
    second.lease.release("drop");
    expect(first.lease.front?.disposed).toBe(true);
    expect(capturesCache.getStats()).toMatchObject({
      residentBytes: 0,
      pinnedEntryCount: 0,
      leaseCount: 0,
    });
  });

  it("deduplicates identical front and back faces within one lease", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(400);
    const identity = page("same");
    const result = capturesCache.acquireTurn(
      {
        turnId: "same-sheet",
        front: { identity, desiredScale: 1 },
        back: { identity, desiredScale: 1 },
      },
      trackingFactory(captures),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.lease.front).toBe(result.lease.back);
    expect(captures).toHaveLength(1);
    expect(capturesCache.getStats()).toMatchObject({
      residentBytes: 400,
      pinnedBytes: 400,
      pinnedEntryCount: 1,
    });
  });

  it("locks a turn to its acquired variant when a sharper one appears", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(4_000);
    const identity = page("locked");
    const factory = trackingFactory(captures);
    const low = capturesCache.prefetch(
      { identity, tier: "prefetch", desiredScale: 1.5 },
      factory,
    );
    const acquired = capturesCache.acquireTurn(
      {
        turnId: "locked-turn",
        front: { identity, desiredScale: 1 },
      },
      factory,
    );
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) {
      return;
    }

    const high = capturesCache.prefetch(
      { identity, tier: "prefetch", desiredScale: 2 },
      factory,
    );
    expect(high?.scale).toBe(2);
    expect(acquired.lease.front).toBe(low);
    expect(acquired.lease.frontScale).toBe(1.5);
    expect(low?.disposed).toBe(false);
    expect(capturesCache.getStats().entryCount).toBe(2);

    acquired.lease.release();

    expect(low?.disposed).toBe(true);
    expect(high?.disposed).toBe(false);
    expect(capturesCache.getStats()).toMatchObject({
      entryCount: 1,
      residentBytes: 1_600,
    });
  });

  it("drops an unpinned lower-resolution variant after a sharper prefetch", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(4_000);
    const identity = page("superseded");
    const factory = trackingFactory(captures);
    const low = capturesCache.prefetch(
      { identity, tier: "prefetch", desiredScale: 1.5 },
      factory,
    );
    const high = capturesCache.prefetch(
      { identity, tier: "prefetch", desiredScale: 2 },
      factory,
    );

    expect(low?.disposed).toBe(true);
    expect(high?.disposed).toBe(false);
    expect(capturesCache.getStats()).toMatchObject({
      entryCount: 1,
      residentBytes: 1_600,
    });
  });

  it("locks resident prefetch variants before synchronously chasing desired quality", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(10_000);
    const front = page("resident-front");
    const back = page("resident-back");
    const factory = trackingFactory(captures);
    const prefetchedFront = capturesCache.prefetch(
      { identity: front, tier: "prefetch", desiredScale: 2 },
      factory,
    );
    const prefetchedBack = capturesCache.prefetch(
      { identity: back, tier: "prefetch", desiredScale: 2 },
      factory,
    );
    const captureCountBeforeTurn = captures.length;

    const result = capturesCache.acquireTurn(
      {
        turnId: "resident-first",
        front: { identity: front, desiredScale: 3 },
        back: { identity: back, desiredScale: 3 },
      },
      factory,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(captures).toHaveLength(captureCountBeforeTurn);
    expect(result.lease.front).toBe(prefetchedFront);
    expect(result.lease.back).toBe(prefetchedBack);
    expect(result.lease.frontScale).toBe(2);
    expect(result.lease.backScale).toBe(2);
  });

  it("reuses a turn variant when nominal scales round to the same pixels", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(100);
    const identity = page("rounded-active", 1, 1);
    const factory = trackingFactory(captures);
    const prefetched = capturesCache.prefetch(
      { identity, tier: "prefetch", desiredScale: 1 },
      factory,
    );
    const result = capturesCache.acquireTurn(
      {
        turnId: "rounded-turn",
        front: {
          identity,
          desiredScale: 1.1,
          minimumScale: 1.1,
        },
      },
      factory,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.lease.front).toBe(prefetched);
    expect(captures).toHaveLength(1);
    expect(capturesCache.getStats()).toMatchObject({
      entryCount: 1,
      residentBytes: 4,
      pinnedBytes: 4,
    });

    result.lease.release("drop");

    expect(prefetched?.disposed).toBe(true);
    expect(capturesCache.getStats()).toMatchObject({
      entryCount: 0,
      residentBytes: 0,
      pinnedBytes: 0,
    });
  });

  it("does not let an old lease release a reused turn id", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(1_000);
    const factory = trackingFactory(captures);
    const first = capturesCache.acquireTurn(
      {
        turnId: "reused-id",
        front: { identity: page("old"), desiredScale: 1 },
      },
      factory,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    first.lease.release("drop");

    const second = capturesCache.acquireTurn(
      {
        turnId: "reused-id",
        front: { identity: page("new"), desiredScale: 1 },
      },
      factory,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    first.lease.release("drop");

    expect(second.lease.front?.disposed).toBe(false);
    expect(capturesCache.getStats()).toMatchObject({
      leaseCount: 1,
      pinnedEntryCount: 1,
    });
    second.lease.release("drop");
    expect(capturesCache.getStats()).toMatchObject({
      leaseCount: 0,
      entryCount: 0,
    });
  });

  it("falls through quality steps before borrowing the active reserve", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(1_000, 4_000);
    const result = capturesCache.acquireTurn(
      {
        turnId: "fallback",
        front: { identity: page("fallback"), desiredScale: 3 },
      },
      trackingFactory(captures),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.lease.frontScale).toBe(1.5);
    expect(capturesCache.getStats().residentBytes).toBe(900);
  });

  it("borrows the hard reserve to guarantee a 1x active capture", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(399, 400);
    const result = capturesCache.acquireTurn(
      {
        turnId: "minimum",
        front: { identity: page("minimum"), desiredScale: 3 },
      },
      trackingFactory(captures),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.lease.frontScale).toBe(1);
    expect(capturesCache.getStats().residentBytes).toBe(400);
  });

  it("reports hard capacity without disturbing existing pinned captures", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(400, 800);
    const factory = trackingFactory(captures);
    const first = capturesCache.acquireTurn(
      {
        turnId: "first",
        front: { identity: page("first"), desiredScale: 1 },
      },
      factory,
    );
    const second = capturesCache.acquireTurn(
      {
        turnId: "second",
        front: {
          identity: page("too-large", 10, 20),
          desiredScale: 1,
        },
      },
      factory,
    );

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "hard-capacity" });
    expect(capturesCache.getStats()).toMatchObject({
      residentBytes: 400,
      pinnedBytes: 400,
      entryCount: 1,
      leaseCount: 1,
    });
  });

  it("forwards caller metadata and makes repeated turn acquisition idempotent", () => {
    const capturesCache = cache(400);
    const seenPageIndexes: number[] = [];
    const identity = page("metadata", 10, 10, 42);
    const factory: CaptureFactory<FakeCapture, FakeMetadata> = (
      captureIdentity,
      scale,
    ) => {
      seenPageIndexes.push(captureIdentity.metadata?.pageIndex ?? -1);
      return fakeCapture(captureIdentity, scale);
    };
    const first = capturesCache.acquireTurn(
      {
        turnId: "metadata-turn",
        front: { identity, desiredScale: 1 },
      },
      factory,
    );
    const second = capturesCache.acquireTurn(
      {
        turnId: "metadata-turn",
        front: { identity: page("different"), desiredScale: 3 },
      },
      factory,
    );

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(second.lease).toBe(first.lease);
    expect(seenPageIndexes).toEqual([42]);
  });

  it("clears pinned entries once and makes later release a no-op", () => {
    const captures: FakeCapture[] = [];
    const capturesCache = cache(400);
    const result = capturesCache.acquireTurn(
      {
        turnId: "clear",
        front: { identity: page("clear"), desiredScale: 1 },
      },
      trackingFactory(captures),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    capturesCache.clear();
    result.lease.release("drop");
    expect(captures).toHaveLength(1);
    expect(captures[0].disposed).toBe(true);
    expect(capturesCache.getStats()).toEqual({
      residentBytes: 0,
      pinnedBytes: 0,
      entryCount: 0,
      pinnedEntryCount: 0,
      leaseCount: 0,
    });
  });
});
