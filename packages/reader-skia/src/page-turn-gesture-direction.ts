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
