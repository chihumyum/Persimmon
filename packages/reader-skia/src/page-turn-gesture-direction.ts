import type { PageTurnDirection } from "./page-turn-direction";

export type { PageTurnDirection } from "./page-turn-direction";

/**
 * Maps physical finger travel to logical reading order.
 *
 * Gesture Handler may report zero translation when a native pan first becomes
 * active, especially on Android. Zero therefore means "not decided yet"
 * instead of defaulting to the backward direction.
 */
export function pageTurnDirectionFromTranslation(
  translationX: number,
): PageTurnDirection | undefined {
  "worklet";
  if (translationX < 0) {
    return 1;
  }
  if (translationX > 0) {
    return -1;
  }
  return undefined;
}

/**
 * Maps physical finger travel to material travel without amplification.
 * One physical pixel of horizontal finger movement moves the paper target by
 * one physical pixel on both single-page and spread layouts.
 */
export function bookXForGestureTravel(
  startBookX: number,
  translationX: number,
  direction: PageTurnDirection,
  physicalPageWidth: number,
): number {
  "worklet";
  const signedTravel = direction === 1 ? translationX : -translationX;
  return Math.min(
    1,
    Math.max(-1, startBookX + signedTravel / Math.max(1, physicalPageWidth)),
  );
}
