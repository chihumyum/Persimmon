import {
  DEFAULT_PAGE_PROFILE_POINTS,
  incomingPageRevealProgress,
} from "@persimmon/page-turn-core";

import { projectPageTurnBookX } from "./page-turn-perspective";

const PROFILE_FLOATS_PER_POINT = 4;

/**
 * Keeps the old incoming-page geometry intact and moves only its projected
 * screen position during the newly added prelude.
 */
export function incomingPageProjectedOffset(
  profile: ArrayLike<number>,
  cameraBookX: number,
  xScale: 1 | -1,
  incomingPageProgress: number | undefined,
): number {
  "worklet";
  if (incomingPageProgress === undefined) {
    return 0;
  }
  const reveal = incomingPageRevealProgress(incomingPageProgress);
  if (reveal >= 1) {
    return 0;
  }
  let maximumX = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const offset = index * PROFILE_FLOATS_PER_POINT;
    maximumX = Math.max(
      maximumX,
      projectPageTurnBookX(
        profile[offset]! * xScale,
        profile[offset + 1]!,
        cameraBookX,
      ),
    );
  }
  return -Math.max(0, maximumX) * (1 - reveal);
}
