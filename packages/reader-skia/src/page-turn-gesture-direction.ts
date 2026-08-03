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
 * Resolves an ordinary drag after applying the physical two-page spread model.
 *
 * A single page keeps accepting either horizontal direction. In a spread, the
 * left physical page only turns right and the right physical page only turns
 * left. The exact spine coordinate belongs to the right page so the two halves
 * remain a deterministic, non-overlapping partition.
 */
export function normalPageTurnDirectionForTouch(
  localX: number,
  translationX: number,
  spread: boolean,
  interactionWidth: number,
): PageTurnDirection | undefined {
  "worklet";
  const direction = pageTurnDirectionFromTranslation(translationX);
  if (!spread || direction === undefined) {
    return direction;
  }
  if (
    !Number.isFinite(localX) ||
    !Number.isFinite(interactionWidth) ||
    interactionWidth <= 0 ||
    localX < 0 ||
    localX > interactionWidth
  ) {
    return undefined;
  }
  const startsOnLeftPage = localX < interactionWidth * 0.5;
  if (direction === -1) {
    return startsOnLeftPage ? direction : undefined;
  }
  return startsOnLeftPage ? undefined : direction;
}

/**
 * Recovers the direction from a terminal Pan sample when Android recognizes a
 * short fling but coalesces every active update into `onEnd`.
 *
 * A vertical or sub-threshold terminal sample is not a page gesture. This
 * keeps a tap or a failed vertical pan from manufacturing a page turn.
 */
export function pageTurnTerminalDirection(
  translationX: number,
  translationY: number,
  minimumHorizontalTravel: number,
): PageTurnDirection | undefined {
  "worklet";
  const horizontalTravel = Math.abs(translationX);
  if (
    !(
      horizontalTravel > Math.max(0, minimumHorizontalTravel) &&
      horizontalTravel > Math.abs(translationY)
    )
  ) {
    return undefined;
  }
  return pageTurnDirectionFromTranslation(translationX);
}

/**
 * Maps a touch origin onto the sheet that will be turned.
 *
 * A spread always uses the complete two-page interaction width. Combined with
 * `normalPageTurnDirectionForTouch`, every valid ordinary drag therefore starts
 * at bookX 0.5..1 and has a full grip; the old near-spine weak-grip range cannot
 * be reached, regardless of whether rapid page turns are enabled. A single page
 * preserves its original physical-page mapping.
 */
export function pageTurnStartBookXForTouch(
  localX: number,
  direction: PageTurnDirection,
  spread: boolean,
  physicalPageWidth: number,
  interactionWidth: number,
): number {
  "worklet";
  const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));
  if (spread) {
    const normalizedX = clampUnit(localX / Math.max(1, interactionWidth));
    return direction === 1 ? normalizedX : 1 - normalizedX;
  }
  return direction === 1
    ? clampUnit(localX / physicalPageWidth)
    : clampUnit(1 - localX / physicalPageWidth);
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

export interface PageTurnGestureReleaseSample {
  readonly currentBookX: number;
  readonly turnProgress: number;
  readonly throwVelocity: number;
}

/**
 * Samples the terminal Pan event instead of assuming the last `onUpdate`
 * reached the finger's release point. Android can coalesce a short fling's
 * final move into `onEnd`; using only the preceding update makes otherwise
 * symmetric fast swipes intermittently fall below the commit threshold.
 */
export function pageTurnGestureReleaseSample(
  startBookX: number,
  translationX: number,
  velocityX: number,
  direction: PageTurnDirection,
  physicalPageWidth: number,
): PageTurnGestureReleaseSample {
  "worklet";
  const safePageWidth = Math.max(1, physicalPageWidth);
  const directionalTravel = direction === 1 ? -translationX : translationX;
  return {
    currentBookX: bookXForGestureTravel(
      startBookX,
      translationX,
      direction,
      safePageWidth,
    ),
    turnProgress: Math.min(
      1,
      Math.max(0, directionalTravel / (safePageWidth * 0.72)),
    ),
    throwVelocity: Math.max(
      0,
      (direction === 1 ? -velocityX : velocityX) / safePageWidth,
    ),
  };
}
