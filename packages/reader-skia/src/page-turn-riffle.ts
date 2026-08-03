import { PAGE_TURN_START_INTERVAL_MS } from "./page-turn-scheduler";

export const PAGE_RIFFLE_START_EDGE_FRACTION = 0.25;
export const PAGE_RIFFLE_ARMED_EDGE_FRACTION = 0.15;
export const PAGE_RIFFLE_MINIMUM_HOLD_MS = 250;
export const PAGE_RIFFLE_INTERVAL_MS = PAGE_TURN_START_INTERVAL_MS;

export const PAGE_RIFFLE_INWARD = 0;
export const PAGE_RIFFLE_PENDING = 1;
export const PAGE_RIFFLE_ARMED = 2;

export interface PageRiffleCandidate {
  /** Right edge turns left (+1); left edge turns right (-1). */
  readonly direction: 1 | -1;
  readonly startEdgeDistance: number;
}

export interface PageRiffleGesture extends PageRiffleCandidate {
  readonly translationX: number;
  readonly translationY: number;
  readonly interactionWidth: number;
  readonly minimumHorizontalTravel: number;
}

/**
 * Finds the outside quarters of the complete interaction surface. The zones
 * are directional overrides, not exclusive gesture regions: an inward drag
 * still belongs to the ordinary page-turn path.
 */
export function pageRiffleCandidateForTouch(
  localX: number,
  interactionWidth: number,
): PageRiffleCandidate | undefined {
  "worklet";
  if (
    !Number.isFinite(localX) ||
    !Number.isFinite(interactionWidth) ||
    interactionWidth <= 0
  ) {
    return undefined;
  }
  if (localX < 0 || localX > interactionWidth) {
    return undefined;
  }
  const leftDistance = localX / interactionWidth;
  if (leftDistance <= PAGE_RIFFLE_START_EDGE_FRACTION) {
    return { direction: -1, startEdgeDistance: leftDistance };
  }
  const rightDistance = (interactionWidth - localX) / interactionWidth;
  if (rightDistance <= PAGE_RIFFLE_START_EDGE_FRACTION) {
    return { direction: 1, startEdgeDistance: rightDistance };
  }
  return undefined;
}

/**
 * A candidate owns nothing until the motion is outward and armed. Returning
 * INWARD is the explicit signal that the existing normal page-turn path must
 * continue untouched.
 */
export function pageRiffleGestureDisposition(
  gesture: PageRiffleGesture,
): 0 | 1 | 2 {
  "worklet";
  const minimumTravel = Math.max(0, gesture.minimumHorizontalTravel);
  const outwardTravel = gesture.direction * gesture.translationX;
  if (outwardTravel <= 0) {
    return PAGE_RIFFLE_INWARD;
  }
  const currentEdgeDistance =
    gesture.startEdgeDistance -
    outwardTravel / Math.max(1, gesture.interactionWidth);
  const armed =
    gesture.startEdgeDistance >= 0 &&
    gesture.startEdgeDistance <= PAGE_RIFFLE_START_EDGE_FRACTION &&
    currentEdgeDistance <= PAGE_RIFFLE_ARMED_EDGE_FRACTION &&
    outwardTravel >= minimumTravel &&
    outwardTravel > Math.abs(gesture.translationY);
  return armed ? PAGE_RIFFLE_ARMED : PAGE_RIFFLE_PENDING;
}

export function pageRiffleHoldReady(armedAtMs: number, nowMs: number): boolean {
  "worklet";
  return (
    Number.isFinite(armedAtMs) &&
    Number.isFinite(nowMs) &&
    nowMs >= armedAtMs + PAGE_RIFFLE_MINIMUM_HOLD_MS
  );
}

/** A delayed frame never creates catch-up turns after the finger is released. */
export function nextPageRiffleTickAt(
  nowMs: number,
  intervalMs = PAGE_RIFFLE_INTERVAL_MS,
): number {
  "worklet";
  return nowMs + Math.max(1, intervalMs);
}
