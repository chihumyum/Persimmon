import type { PageCaptureTier } from "./page-capture-quality";
import {
  PAGE_CAPTURE_MIN_SCALE,
  pageCapturePixelSize,
} from "./page-capture-budget";

export type { PageCaptureTier } from "./page-capture-quality";

export interface PageCaptureIdentity<Metadata = unknown> {
  /**
   * Stable content identity supplied by the reader. Render-affecting revisions
   * belong in this key; capture scale does not.
   */
  readonly key: string;
  readonly width: number;
  readonly height: number;
  /**
   * Opaque caller data forwarded to the capture factory. The cache never reads
   * it, so callers may attach a PageAddress or another render lookup token.
   */
  readonly metadata?: Metadata;
}

export interface PageCaptureCacheValue {
  readonly scale: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly byteSize: number;
  dispose(): void;
}

export interface PageCaptureRequest<Metadata = unknown> {
  readonly identity: PageCaptureIdentity<Metadata>;
  readonly tier: Exclude<PageCaptureTier, "active">;
  readonly desiredScale: number;
  /**
   * Zero makes the request opportunistic. The cache still tries its standard
   * scale fallbacks, but may return null instead of borrowing active reserve.
   */
  readonly minimumScale?: number;
}

export interface TurnFaceCaptureRequest<Metadata = unknown> {
  readonly identity: PageCaptureIdentity<Metadata>;
  readonly desiredScale: number;
  readonly minimumScale?: number;
}

export interface TurnCaptureRequest<Metadata = unknown> {
  readonly turnId: string;
  readonly front?: TurnFaceCaptureRequest<Metadata>;
  readonly back?: TurnFaceCaptureRequest<Metadata>;
}

export type CaptureFactory<
  Value extends PageCaptureCacheValue,
  Metadata = unknown,
> = (identity: PageCaptureIdentity<Metadata>, scale: number) => Value | null;

export type ReleasedCaptureTier = "prefetch" | "background" | "drop";

export interface TurnCaptureLease<Value extends PageCaptureCacheValue> {
  readonly turnId: string;
  readonly front?: Value;
  readonly back?: Value;
  readonly frontScale?: number;
  readonly backScale?: number;
  release(retainAs?: ReleasedCaptureTier): void;
}

export type TurnCaptureAcquireResult<Value extends PageCaptureCacheValue> =
  | { readonly ok: true; readonly lease: TurnCaptureLease<Value> }
  | {
      readonly ok: false;
      readonly reason: "capture-failed" | "hard-capacity";
    };

export interface PageCaptureRetention<Metadata = unknown> {
  readonly identity: PageCaptureIdentity<Metadata>;
  readonly tier: PageCaptureTier;
}

export interface PageCaptureCacheStats {
  readonly residentBytes: number;
  readonly pinnedBytes: number;
  readonly entryCount: number;
  readonly pinnedEntryCount: number;
  readonly leaseCount: number;
}

export interface CapturedPageCacheOptions<Value extends PageCaptureCacheValue> {
  readonly targetByteBudget: number;
  readonly hardByteBudget: number;
  /**
   * The reader can inject its after-paint release helper here. Tests normally
   * use the value's synchronous dispose method.
   */
  readonly disposeValue?: (value: Value) => void;
}

interface CacheEntry<Value extends PageCaptureCacheValue, Metadata = unknown> {
  readonly identityId: string;
  readonly variantId: string;
  readonly identity: PageCaptureIdentity<Metadata>;
  readonly value: Value;
  tier: PageCaptureTier;
  lastUsed: number;
  pinCount: number;
  disposed: boolean;
}

interface InternalTurnLease<
  Value extends PageCaptureCacheValue,
  Metadata = unknown,
> {
  readonly turnId: string;
  readonly front?: CacheEntry<Value, Metadata>;
  readonly back?: CacheEntry<Value, Metadata>;
  readonly pinnedEntries: readonly CacheEntry<Value, Metadata>[];
  readonly publicLease: TurnCaptureLease<Value>;
  released: boolean;
}

interface PlannedFace<Value extends PageCaptureCacheValue, Metadata = unknown> {
  readonly request: TurnFaceCaptureRequest<Metadata>;
  readonly requestedScale: number;
  readonly entry?: CacheEntry<Value, Metadata>;
  readonly identityId: string;
  readonly variantId: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly byteSize: number;
}

type AttemptTurnResult<
  Value extends PageCaptureCacheValue,
  Metadata = unknown,
> =
  | { readonly status: "capacity" }
  | { readonly status: "capture-failed" }
  | {
      readonly status: "success";
      readonly front?: CacheEntry<Value, Metadata>;
      readonly back?: CacheEntry<Value, Metadata>;
    };

const STANDARD_SCALE_STEPS = [3, 2.5, 2, 1.5, PAGE_CAPTURE_MIN_SCALE] as const;

const TIER_PRIORITY: Readonly<Record<PageCaptureTier, number>> = {
  background: 0,
  prefetch: 1,
  active: 2,
};

/**
 * Byte-accounted capture cache with immutable per-turn texture leases.
 *
 * Animation lane capacity is intentionally not part of this API. Admission is
 * based only on resident bytes, requested quality, and actual pinned captures.
 */
export class CapturedPageCache<
  Value extends PageCaptureCacheValue,
  Metadata = unknown,
> {
  readonly targetByteBudget: number;
  readonly hardByteBudget: number;

  private readonly entries = new Map<string, CacheEntry<Value, Metadata>>();
  private readonly leases = new Map<
    string,
    InternalTurnLease<Value, Metadata>
  >();
  private readonly disposeValue: (value: Value) => void;
  private residentBytes = 0;
  private usageCounter = 0;

  constructor(options: CapturedPageCacheOptions<Value>) {
    assertPositiveSafeInteger(options.targetByteBudget, "targetByteBudget");
    assertPositiveSafeInteger(options.hardByteBudget, "hardByteBudget");
    if (options.hardByteBudget < options.targetByteBudget) {
      throw new RangeError(
        "hardByteBudget must be greater than or equal to targetByteBudget",
      );
    }
    this.targetByteBudget = options.targetByteBudget;
    this.hardByteBudget = options.hardByteBudget;
    this.disposeValue =
      options.disposeValue ?? ((value: Value) => value.dispose());
  }

  /**
   * Creates or reuses an unpinned cache entry. Opportunistic work never borrows
   * the active hard-budget reserve.
   */
  prefetch(
    request: PageCaptureRequest<Metadata>,
    factory: CaptureFactory<Value, Metadata>,
  ): Value | null {
    const normalized = normalizePassiveRequest(request);
    const scales = fallbackScales(
      normalized.desiredScale,
      normalized.minimumScale,
    );

    for (const scale of scales) {
      const reusable = this.findReusableEntry(normalized.identity, scale);
      if (reusable) {
        reusable.tier = higherTier(reusable.tier, normalized.tier);
        this.touch(reusable);
        return reusable.value;
      }

      const dimensions = captureDimensions(normalized.identity, scale);
      const identityId = captureIdentityId(normalized.identity);
      const existingVariant = this.entries.get(
        captureVariantId(
          identityId,
          dimensions.pixelWidth,
          dimensions.pixelHeight,
        ),
      );
      if (existingVariant) {
        existingVariant.tier = higherTier(
          existingVariant.tier,
          normalized.tier,
        );
        this.touch(existingVariant);
        return existingVariant.value;
      }
      if (
        !this.evictToFit(
          dimensions.byteSize,
          this.targetByteBudget,
          normalized.tier,
          new Set(),
        )
      ) {
        continue;
      }

      const value = factory(normalized.identity, scale);
      if (!value) {
        continue;
      }
      this.assertCaptureValue(normalized.identity, scale, value);
      const entry = this.createEntry(
        normalized.identity,
        normalized.tier,
        value,
      );
      const installed = this.installEntry(entry);
      installed.tier = higherTier(installed.tier, normalized.tier);
      this.touch(installed);
      this.removeSupersededUnpinnedEntries(installed);
      return installed.value;
    }
    return null;
  }

  hasResident(
    identity: PageCaptureIdentity<Metadata>,
    minimumScale: number,
  ): boolean {
    assertCaptureIdentity(identity);
    return (
      this.findReusableEntry(
        identity,
        assertPositiveScale(minimumScale, "minimumScale"),
      ) !== undefined
    );
  }

  /**
   * Installs a value produced asynchronously outside the cache.
   *
   * Active feeder jobs may use the hard reserve before acquireTurn pins both
   * faces atomically. Passive inventory remains constrained to the target
   * budget and can never crowd out active paper.
   */
  installPrepared(
    identity: PageCaptureIdentity<Metadata>,
    tier: PageCaptureTier,
    value: Value,
  ): Value | null {
    assertCaptureIdentity(identity);
    this.assertCaptureValue(identity, value.scale, value);
    const reusable = this.findReusableEntry(identity, value.scale);
    if (reusable) {
      reusable.tier = higherTier(reusable.tier, tier);
      this.touch(reusable);
      this.disposeValue(value);
      return reusable.value;
    }

    const byteLimit =
      tier === "active" ? this.hardByteBudget : this.targetByteBudget;
    if (!this.evictToFit(value.byteSize, byteLimit, tier, new Set())) {
      this.disposeValue(value);
      return null;
    }
    const entry = this.createEntry(identity, tier, value);
    const installed = this.installEntry(entry);
    installed.tier = higherTier(installed.tier, tier);
    this.touch(installed);
    this.removeSupersededUnpinnedEntries(installed);
    return installed.value;
  }

  /**
   * Atomically acquires the physical front/back textures for a turn. Both
   * references stay fixed until the returned lease is released.
   */
  acquireTurn(
    request: TurnCaptureRequest<Metadata>,
    factory: CaptureFactory<Value, Metadata>,
  ): TurnCaptureAcquireResult<Value> {
    if (!request.turnId) {
      throw new TypeError("turnId must not be empty");
    }
    const existingLease = this.leases.get(request.turnId);
    if (existingLease) {
      return { ok: true, lease: existingLease.publicLease };
    }
    if (!request.front && !request.back) {
      throw new TypeError("a turn capture requires a front or back face");
    }

    const front = request.front
      ? normalizeActiveRequest(request.front)
      : undefined;
    const back = request.back
      ? normalizeActiveRequest(request.back)
      : undefined;
    const residentFirstPlan = {
      frontScale: front
        ? (this.bestResidentScale(front) ?? front.desiredScale)
        : undefined,
      backScale: back
        ? (this.bestResidentScale(back) ?? back.desiredScale)
        : undefined,
    };
    const plans = uniqueScalePlans([
      residentFirstPlan,
      ...turnScalePlans(front, back),
    ]);

    for (const plan of plans) {
      const result = this.attemptTurnPlan(
        request.turnId,
        front,
        back,
        plan.frontScale,
        plan.backScale,
        this.targetByteBudget,
        factory,
      );
      if (result.status === "success") {
        return {
          ok: true,
          lease: this.installLease(request.turnId, result.front, result.back),
        };
      }
    }

    const minimumPlan = minimumTurnScalePlan(front, back);
    const hardResult = this.attemptTurnPlan(
      request.turnId,
      front,
      back,
      minimumPlan.frontScale,
      minimumPlan.backScale,
      this.hardByteBudget,
      factory,
    );
    if (hardResult.status === "success") {
      return {
        ok: true,
        lease: this.installLease(
          request.turnId,
          hardResult.front,
          hardResult.back,
        ),
      };
    }
    return {
      ok: false,
      reason:
        hardResult.status === "capacity" ? "hard-capacity" : "capture-failed",
    };
  }

  /**
   * Reconciles the current prefetch plan. Unlisted, unpinned captures are
   * demoted to background; pinned turn captures remain active and untouched.
   */
  reconcileUnpinnedTiers(
    retentions: readonly PageCaptureRetention<Metadata>[],
  ): void {
    const requestedTiers = new Map<string, PageCaptureTier>();
    for (const retention of retentions) {
      const identityId = captureIdentityId(retention.identity);
      const current = requestedTiers.get(identityId);
      requestedTiers.set(
        identityId,
        current ? higherTier(current, retention.tier) : retention.tier,
      );
    }

    for (const entry of this.entries.values()) {
      if (entry.pinCount > 0) {
        continue;
      }
      entry.tier = requestedTiers.get(entry.identityId) ?? "background";
    }
    this.trimToTargetBudget();
  }

  getStats(): PageCaptureCacheStats {
    let pinnedBytes = 0;
    let pinnedEntryCount = 0;
    for (const entry of this.entries.values()) {
      if (entry.pinCount > 0) {
        pinnedBytes += entry.value.byteSize;
        pinnedEntryCount += 1;
      }
    }
    return {
      residentBytes: this.residentBytes,
      pinnedBytes,
      entryCount: this.entries.size,
      pinnedEntryCount,
      leaseCount: this.leases.size,
    };
  }

  clear(): void {
    for (const lease of this.leases.values()) {
      lease.released = true;
    }
    this.leases.clear();
    for (const entry of this.entries.values()) {
      this.disposeEntry(entry);
    }
    this.entries.clear();
    this.residentBytes = 0;
  }

  private attemptTurnPlan(
    turnId: string,
    front: TurnFaceCaptureRequest<Metadata> | undefined,
    back: TurnFaceCaptureRequest<Metadata> | undefined,
    frontScale: number | undefined,
    backScale: number | undefined,
    byteLimit: number,
    factory: CaptureFactory<Value, Metadata>,
  ): AttemptTurnResult<Value, Metadata> {
    const plannedFront =
      front && frontScale !== undefined
        ? this.planFace(front, frontScale)
        : undefined;
    const plannedBack =
      back && backScale !== undefined
        ? this.planFace(back, backScale)
        : undefined;
    const plannedFaces = [plannedFront, plannedBack].filter(
      (face): face is PlannedFace<Value, Metadata> => face !== undefined,
    );
    const protectedVariants = new Set(
      plannedFaces
        .map((face) => face.entry?.variantId)
        .filter((variant): variant is string => variant !== undefined),
    );
    const missing = new Map<string, PlannedFace<Value, Metadata>>();
    for (const face of plannedFaces) {
      if (!face.entry) {
        missing.set(face.variantId, face);
      }
    }
    const additionalBytes = [...missing.values()].reduce(
      (total, face) => total + face.byteSize,
      0,
    );

    if (
      !this.evictToFit(additionalBytes, byteLimit, "active", protectedVariants)
    ) {
      return { status: "capacity" };
    }

    const staged = new Map<string, CacheEntry<Value, Metadata>>();
    try {
      for (const face of missing.values()) {
        const value = factory(face.request.identity, face.requestedScale);
        if (!value) {
          for (const entry of staged.values()) {
            this.disposeEntry(entry);
          }
          return { status: "capture-failed" };
        }
        this.assertCaptureValue(
          face.request.identity,
          face.requestedScale,
          value,
        );
        staged.set(
          face.variantId,
          this.createEntry(face.request.identity, "active", value),
        );
      }
    } catch (error) {
      for (const entry of staged.values()) {
        this.disposeEntry(entry);
      }
      throw error;
    }

    const installed = new Map<string, CacheEntry<Value, Metadata>>();
    for (const entry of staged.values()) {
      installed.set(entry.variantId, this.installEntry(entry));
    }
    const resolve = (
      face: PlannedFace<Value, Metadata> | undefined,
    ): CacheEntry<Value, Metadata> | undefined =>
      face?.entry ?? (face ? installed.get(face.variantId) : undefined);
    const resolvedFront = resolve(plannedFront);
    const resolvedBack = resolve(plannedBack);
    if ((front && !resolvedFront) || (back && !resolvedBack)) {
      throw new Error(`failed to resolve captured faces for turn ${turnId}`);
    }
    return {
      status: "success",
      front: resolvedFront,
      back: resolvedBack,
    };
  }

  private planFace(
    request: TurnFaceCaptureRequest<Metadata>,
    scale: number,
  ): PlannedFace<Value, Metadata> {
    const entry = this.findReusableEntry(request.identity, scale);
    if (entry) {
      return {
        request,
        requestedScale: scale,
        entry,
        identityId: entry.identityId,
        variantId: entry.variantId,
        pixelWidth: entry.value.pixelWidth,
        pixelHeight: entry.value.pixelHeight,
        byteSize: entry.value.byteSize,
      };
    }
    const identityId = captureIdentityId(request.identity);
    const dimensions = captureDimensions(request.identity, scale);
    const variantId = captureVariantId(
      identityId,
      dimensions.pixelWidth,
      dimensions.pixelHeight,
    );
    const existingVariant = this.entries.get(variantId);
    if (existingVariant) {
      return {
        request,
        requestedScale: scale,
        entry: existingVariant,
        identityId,
        variantId,
        pixelWidth: existingVariant.value.pixelWidth,
        pixelHeight: existingVariant.value.pixelHeight,
        byteSize: existingVariant.value.byteSize,
      };
    }
    return {
      request,
      requestedScale: scale,
      identityId,
      variantId,
      ...dimensions,
    };
  }

  private installLease(
    turnId: string,
    front: CacheEntry<Value, Metadata> | undefined,
    back: CacheEntry<Value, Metadata> | undefined,
  ): TurnCaptureLease<Value> {
    const pinnedEntries = [
      ...new Set([front, back].filter(Boolean)),
    ] as CacheEntry<Value, Metadata>[];
    for (const entry of pinnedEntries) {
      entry.pinCount += 1;
      entry.tier = "active";
      this.touch(entry);
    }

    const publicLease: TurnCaptureLease<Value> = {
      turnId,
      front: front?.value,
      back: back?.value,
      frontScale: front?.value.scale,
      backScale: back?.value.scale,
      release: (retainAs = "prefetch") => {
        const current = this.leases.get(turnId);
        if (current?.publicLease === publicLease) {
          this.releaseLease(current, retainAs);
        }
      },
    };
    const internalLease: InternalTurnLease<Value, Metadata> = {
      turnId,
      front,
      back,
      pinnedEntries,
      publicLease,
      released: false,
    };
    this.leases.set(turnId, internalLease);
    return publicLease;
  }

  private releaseLease(
    lease: InternalTurnLease<Value, Metadata>,
    retainAs: ReleasedCaptureTier,
  ): void {
    if (lease.released) {
      return;
    }
    lease.released = true;
    this.leases.delete(lease.turnId);
    const releasedIdentityIds = new Set<string>();
    for (const entry of lease.pinnedEntries) {
      entry.pinCount = Math.max(0, entry.pinCount - 1);
      if (entry.pinCount > 0) {
        continue;
      }
      if (retainAs === "drop") {
        this.removeEntry(entry);
      } else {
        entry.tier = retainAs;
        this.touch(entry);
      }
      releasedIdentityIds.add(entry.identityId);
    }
    for (const identityId of releasedIdentityIds) {
      this.removeSupersededIdentityVariants(identityId);
    }
    this.trimToTargetBudget();
  }

  private findReusableEntry(
    identity: PageCaptureIdentity<Metadata>,
    minimumScale: number,
  ): CacheEntry<Value, Metadata> | undefined {
    const identityId = captureIdentityId(identity);
    let match: CacheEntry<Value, Metadata> | undefined;
    for (const entry of this.entries.values()) {
      if (
        entry.identityId !== identityId ||
        entry.value.scale + Number.EPSILON < minimumScale
      ) {
        continue;
      }
      if (!match || entry.value.scale < match.value.scale) {
        match = entry;
      }
    }
    return match;
  }

  private bestResidentScale(
    request: TurnFaceCaptureRequest<Metadata>,
  ): number | undefined {
    const identityId = captureIdentityId(request.identity);
    let sufficient: CacheEntry<Value, Metadata> | undefined;
    let fallback: CacheEntry<Value, Metadata> | undefined;
    const minimumScale = request.minimumScale ?? PAGE_CAPTURE_MIN_SCALE;
    for (const entry of this.entries.values()) {
      if (
        entry.identityId !== identityId ||
        entry.value.scale + Number.EPSILON < minimumScale
      ) {
        continue;
      }
      if (entry.value.scale + Number.EPSILON >= request.desiredScale) {
        if (!sufficient || entry.value.scale < sufficient.value.scale) {
          sufficient = entry;
        }
      } else if (!fallback || entry.value.scale > fallback.value.scale) {
        fallback = entry;
      }
    }
    return (sufficient ?? fallback)?.value.scale;
  }

  private createEntry(
    identity: PageCaptureIdentity<Metadata>,
    tier: PageCaptureTier,
    value: Value,
  ): CacheEntry<Value, Metadata> {
    const identityId = captureIdentityId(identity);
    return {
      identityId,
      variantId: captureVariantId(
        identityId,
        value.pixelWidth,
        value.pixelHeight,
      ),
      identity,
      value,
      tier,
      lastUsed: ++this.usageCounter,
      pinCount: 0,
      disposed: false,
    };
  }

  private installEntry(
    entry: CacheEntry<Value, Metadata>,
  ): CacheEntry<Value, Metadata> {
    const existing = this.entries.get(entry.variantId);
    if (existing) {
      this.disposeEntry(entry);
      return existing;
    }
    this.entries.set(entry.variantId, entry);
    this.residentBytes += entry.value.byteSize;
    return entry;
  }

  private evictToFit(
    additionalBytes: number,
    byteLimit: number,
    incomingTier: PageCaptureTier,
    protectedVariants: ReadonlySet<string>,
  ): boolean {
    if (this.residentBytes + additionalBytes <= byteLimit) {
      return true;
    }
    const maximumPriority = TIER_PRIORITY[incomingTier];
    const candidates = [...this.entries.values()]
      .filter(
        (entry) =>
          entry.pinCount === 0 &&
          !protectedVariants.has(entry.variantId) &&
          TIER_PRIORITY[entry.tier] <= maximumPriority,
      )
      .sort(
        (left, right) =>
          TIER_PRIORITY[left.tier] - TIER_PRIORITY[right.tier] ||
          left.lastUsed - right.lastUsed,
      );
    for (const entry of candidates) {
      if (this.residentBytes + additionalBytes <= byteLimit) {
        break;
      }
      this.removeEntry(entry);
    }
    return this.residentBytes + additionalBytes <= byteLimit;
  }

  private trimToTargetBudget(): void {
    // Prepared active faces are a short reservation between worker completion
    // and atomic turn acquisition. Only passive entries may be trimmed here;
    // stale active reservations are first demoted by reconciliation.
    this.evictToFit(0, this.targetByteBudget, "prefetch", new Set<string>());
  }

  private removeEntry(entry: CacheEntry<Value, Metadata>): void {
    if (entry.pinCount > 0 || !this.entries.delete(entry.variantId)) {
      return;
    }
    this.residentBytes -= entry.value.byteSize;
    this.disposeEntry(entry);
  }

  private removeSupersededUnpinnedEntries(
    replacement: CacheEntry<Value, Metadata>,
  ): void {
    for (const entry of this.entries.values()) {
      if (
        entry !== replacement &&
        entry.identityId === replacement.identityId &&
        entry.pinCount === 0 &&
        entry.value.scale <= replacement.value.scale
      ) {
        this.removeEntry(entry);
      }
    }
  }

  private removeSupersededIdentityVariants(identityId: string): void {
    let sharpest: CacheEntry<Value, Metadata> | undefined;
    for (const entry of this.entries.values()) {
      if (
        entry.identityId === identityId &&
        (!sharpest || entry.value.scale > sharpest.value.scale)
      ) {
        sharpest = entry;
      }
    }
    if (sharpest) {
      this.removeSupersededUnpinnedEntries(sharpest);
    }
  }

  private disposeEntry(entry: CacheEntry<Value, Metadata>): void {
    if (entry.disposed) {
      return;
    }
    entry.disposed = true;
    this.disposeValue(entry.value);
  }

  private touch(entry: CacheEntry<Value, Metadata>): void {
    entry.lastUsed = ++this.usageCounter;
  }

  private assertCaptureValue(
    identity: PageCaptureIdentity<Metadata>,
    requestedScale: number,
    value: Value,
  ): void {
    const expected = captureDimensions(identity, requestedScale);
    const valid =
      Number.isFinite(value.scale) &&
      Math.abs(value.scale - requestedScale) < 1e-7 &&
      Number.isSafeInteger(value.pixelWidth) &&
      Number.isSafeInteger(value.pixelHeight) &&
      Number.isSafeInteger(value.byteSize) &&
      value.pixelWidth === expected.pixelWidth &&
      value.pixelHeight === expected.pixelHeight &&
      value.byteSize === expected.byteSize;
    if (valid) {
      return;
    }
    this.disposeValue(value);
    throw new TypeError(
      "captured page dimensions and byteSize must match the requested scale",
    );
  }
}

function normalizePassiveRequest<Metadata>(
  request: PageCaptureRequest<Metadata>,
): Required<Omit<PageCaptureRequest<Metadata>, "minimumScale">> & {
  readonly minimumScale: number;
} {
  assertCaptureIdentity(request.identity);
  const desiredScale = assertPositiveScale(
    request.desiredScale,
    "desiredScale",
  );
  const minimumScale = normalizeMinimumScale(
    request.minimumScale,
    desiredScale,
  );
  return {
    ...request,
    desiredScale: Math.max(desiredScale, minimumScale),
    minimumScale,
  };
}

function normalizeActiveRequest<Metadata>(
  request: TurnFaceCaptureRequest<Metadata>,
): TurnFaceCaptureRequest<Metadata> & {
  readonly desiredScale: number;
  readonly minimumScale: number;
} {
  assertCaptureIdentity(request.identity);
  const requestedMinimum = normalizeMinimumScale(
    request.minimumScale,
    PAGE_CAPTURE_MIN_SCALE,
  );
  const minimumScale = Math.max(PAGE_CAPTURE_MIN_SCALE, requestedMinimum);
  return {
    ...request,
    desiredScale: Math.max(
      minimumScale,
      assertPositiveScale(request.desiredScale, "desiredScale"),
    ),
    minimumScale,
  };
}

function normalizeMinimumScale(
  scale: number | undefined,
  fallback: number,
): number {
  if (scale === undefined) {
    return fallback;
  }
  if (!Number.isFinite(scale) || scale < 0) {
    throw new RangeError("minimumScale must be finite and non-negative");
  }
  return scale;
}

function fallbackScales(
  desiredScale: number,
  minimumScale: number,
): readonly number[] {
  const effectiveFloor =
    minimumScale > 0
      ? minimumScale
      : Math.min(PAGE_CAPTURE_MIN_SCALE, desiredScale);
  const candidates = [
    desiredScale,
    ...STANDARD_SCALE_STEPS,
    effectiveFloor,
  ].filter(
    (scale) =>
      scale <= desiredScale + Number.EPSILON &&
      scale + Number.EPSILON >= effectiveFloor,
  );
  return uniqueDescending(candidates);
}

function turnScalePlans<Metadata>(
  front: TurnFaceCaptureRequest<Metadata> | undefined,
  back: TurnFaceCaptureRequest<Metadata> | undefined,
): readonly { frontScale?: number; backScale?: number }[] {
  const desiredScales = [front?.desiredScale, back?.desiredScale].filter(
    (scale): scale is number => scale !== undefined,
  );
  const minimumScales = [front?.minimumScale, back?.minimumScale].filter(
    (scale): scale is number => scale !== undefined,
  );
  const maximumDesired = Math.max(...desiredScales);
  const minimumFloor = Math.min(...minimumScales);
  const levels = fallbackScales(maximumDesired, minimumFloor);
  const plans = levels.map((level) => ({
    frontScale: front
      ? Math.max(
          front.minimumScale ?? PAGE_CAPTURE_MIN_SCALE,
          Math.min(front.desiredScale, level),
        )
      : undefined,
    backScale: back
      ? Math.max(
          back.minimumScale ?? PAGE_CAPTURE_MIN_SCALE,
          Math.min(back.desiredScale, level),
        )
      : undefined,
  }));
  return uniqueScalePlans(plans);
}

function minimumTurnScalePlan<Metadata>(
  front: TurnFaceCaptureRequest<Metadata> | undefined,
  back: TurnFaceCaptureRequest<Metadata> | undefined,
): { frontScale?: number; backScale?: number } {
  return {
    frontScale: front
      ? Math.max(
          PAGE_CAPTURE_MIN_SCALE,
          front.minimumScale ?? PAGE_CAPTURE_MIN_SCALE,
        )
      : undefined,
    backScale: back
      ? Math.max(
          PAGE_CAPTURE_MIN_SCALE,
          back.minimumScale ?? PAGE_CAPTURE_MIN_SCALE,
        )
      : undefined,
  };
}

function uniqueScalePlans(
  plans: readonly { frontScale?: number; backScale?: number }[],
): readonly { frontScale?: number; backScale?: number }[] {
  const unique = new Map<string, { frontScale?: number; backScale?: number }>();
  for (const plan of plans) {
    unique.set(`${plan.frontScale ?? "-"}:${plan.backScale ?? "-"}`, plan);
  }
  return [...unique.values()];
}

function uniqueDescending(scales: readonly number[]): readonly number[] {
  return [...new Set(scales)].sort((left, right) => right - left);
}

function captureDimensions<Metadata>(
  identity: PageCaptureIdentity<Metadata>,
  scale: number,
): {
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly byteSize: number;
} {
  const pixelSize = pageCapturePixelSize(
    identity.width,
    identity.height,
    scale,
  );
  if (!pixelSize || !Number.isSafeInteger(pixelSize.byteSize)) {
    throw new RangeError("captured page byteSize exceeds safe integer range");
  }
  return {
    pixelWidth: pixelSize.width,
    pixelHeight: pixelSize.height,
    byteSize: pixelSize.byteSize,
  };
}

function captureIdentityId<Metadata>(
  identity: PageCaptureIdentity<Metadata>,
): string {
  assertCaptureIdentity(identity);
  return `${identity.key.length}:${identity.key}:${identity.width}:${identity.height}`;
}

function captureVariantId(
  identityId: string,
  pixelWidth: number,
  pixelHeight: number,
): string {
  return `${identityId}@${pixelWidth}x${pixelHeight}`;
}

function assertCaptureIdentity<Metadata>(
  identity: PageCaptureIdentity<Metadata>,
): void {
  if (!identity.key) {
    throw new TypeError("capture identity key must not be empty");
  }
  if (
    !Number.isFinite(identity.width) ||
    !Number.isFinite(identity.height) ||
    identity.width <= 0 ||
    identity.height <= 0
  ) {
    throw new RangeError("capture identity dimensions must be positive");
  }
}

function assertPositiveScale(scale: number, name: string): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError(`${name} must be finite and positive`);
  }
  return scale;
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function higherTier(
  left: PageCaptureTier,
  right: PageCaptureTier,
): PageCaptureTier {
  return TIER_PRIORITY[left] >= TIER_PRIORITY[right] ? left : right;
}
