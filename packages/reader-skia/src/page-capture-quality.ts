import {
  PAGE_CAPTURE_MAX_SCALE,
  PAGE_CAPTURE_MIN_SCALE,
} from "./page-capture-budget";

export type PageCaptureTier = "active" | "prefetch" | "background";

export type PageTurnInputKind = "gesture" | "tap";

export interface PageCaptureQualityInput {
  readonly tier: PageCaptureTier;
  readonly devicePixelRatio: number;
  readonly inputKind?: PageTurnInputKind;
  readonly recentStartsPerSecond?: number;
  readonly activeTurnCount?: number;
  readonly maxPerspectiveScale?: number;
}

export interface PageCaptureQuality {
  /**
   * Scale requested for a newly captured page. A cache may select a lower
   * scale when the requested texture cannot fit.
   */
  readonly desiredScale: number;
  /**
   * Active turns must retain at least a 1x capture. Non-active work is
   * opportunistic and may be skipped when the cache has no room.
   */
  readonly minimumScale: number;
  /**
   * Pixel-perfect scale before the practical mobile caps are applied. This is
   * diagnostic policy data; it must not be used as a cache reservation.
   */
  readonly idealPerspectiveScale: number;
}

const ACTIVE_GESTURE_MAX_SCALE = PAGE_CAPTURE_MAX_SCALE;
const ACTIVE_TAP_MAX_SCALE = 2.5;
const BUSY_TAP_MAX_SCALE = 2;
const BURST_TAP_MAX_SCALE = 1.5;
const PREFETCH_MAX_SCALE = 2;
const BACKGROUND_MAX_SCALE = 1.5;

/**
 * Chooses the quality of a new capture from actual input pressure. Animation
 * lane capacity is deliberately absent from this API.
 *
 * The selected quality is immutable once a turn acquires its texture lease.
 */
export function selectPageCaptureQuality(
  input: PageCaptureQualityInput,
): PageCaptureQuality {
  const devicePixelRatio = finitePositiveOr(
    input.devicePixelRatio,
    PAGE_CAPTURE_MIN_SCALE,
  );
  const perspectiveScale = finitePositiveOr(input.maxPerspectiveScale, 1);
  const idealPerspectiveScale = devicePixelRatio * perspectiveScale;

  if (input.tier === "background") {
    return {
      desiredScale: Math.min(devicePixelRatio, BACKGROUND_MAX_SCALE),
      minimumScale: 0,
      idealPerspectiveScale,
    };
  }

  if (input.tier === "prefetch") {
    return {
      desiredScale: Math.min(devicePixelRatio, PREFETCH_MAX_SCALE),
      minimumScale: 0,
      idealPerspectiveScale,
    };
  }

  const inputKind = input.inputKind ?? "tap";
  if (inputKind === "gesture") {
    return {
      desiredScale: Math.max(
        PAGE_CAPTURE_MIN_SCALE,
        Math.min(devicePixelRatio, ACTIVE_GESTURE_MAX_SCALE),
      ),
      minimumScale: PAGE_CAPTURE_MIN_SCALE,
      idealPerspectiveScale,
    };
  }

  const recentStartsPerSecond = finiteNonNegativeOr(
    input.recentStartsPerSecond,
    0,
  );
  const activeTurnCount = Math.floor(
    finiteNonNegativeOr(input.activeTurnCount, 0),
  );
  const maximumScale =
    recentStartsPerSecond >= 5 || activeTurnCount >= 4
      ? BURST_TAP_MAX_SCALE
      : recentStartsPerSecond >= 2.5 || activeTurnCount >= 2
        ? BUSY_TAP_MAX_SCALE
        : ACTIVE_TAP_MAX_SCALE;

  return {
    desiredScale: Math.max(
      PAGE_CAPTURE_MIN_SCALE,
      Math.min(devicePixelRatio, maximumScale),
    ),
    minimumScale: PAGE_CAPTURE_MIN_SCALE,
    idealPerspectiveScale,
  };
}

function finitePositiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function finiteNonNegativeOr(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}
