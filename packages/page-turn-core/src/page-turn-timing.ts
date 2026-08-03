import {
  clampPageTurnTuning,
  turnPropagationSpeed,
  type PageTurnTuning,
} from "./page-turn-gesture";

export const AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS = 0.12;
export const INCOMING_PAGE_SETTLE_DURATION_SECONDS = 0.52;
/** The exact first geometry sample used by the original incoming-page turn. */
export const INCOMING_PAGE_LANDING_START_PROGRESS = 0.3;
/**
 * Gesture distance reserved for revealing the original first pose. At the
 * boundary the geometry and screen position are exactly the old first frame.
 */
export const INCOMING_PAGE_PRELUDE_PROGRESS = 0.28;
export const PAGE_TURN_PROPAGATION_SPEED_SCALE = 1.15;

export function incomingPageShapeProgress(progress: number): number {
  "worklet";
  const safeProgress = Math.min(1, Math.max(0, progress));
  if (safeProgress <= INCOMING_PAGE_PRELUDE_PROGRESS) {
    return INCOMING_PAGE_LANDING_START_PROGRESS;
  }
  const landingProgress =
    (safeProgress - INCOMING_PAGE_PRELUDE_PROGRESS) /
    (1 - INCOMING_PAGE_PRELUDE_PROGRESS);
  return (
    INCOMING_PAGE_LANDING_START_PROGRESS +
    (1 - INCOMING_PAGE_LANDING_START_PROGRESS) * landingProgress
  );
}

export function incomingPageRevealProgress(progress: number): number {
  "worklet";
  return Math.min(1, Math.max(0, progress) / INCOMING_PAGE_PRELUDE_PROGRESS);
}

export function incomingPageRemainingDurationSeconds(progress: number): number {
  "worklet";
  return (
    (INCOMING_PAGE_SETTLE_DURATION_SECONDS *
      (1 - Math.min(1, Math.max(0, progress)))) /
    (1 - INCOMING_PAGE_PRELUDE_PROGRESS)
  );
}

/**
 * Advances an incoming-page landing without changing the old landing motion.
 *
 * Before the join, only the renderer's reveal offset moves. Once the original
 * first pose is fully visible, the old 0.52 second ease-out starts from that
 * exact pose. A gesture released after the join keeps the old remaining-time
 * and easing behavior from its current pose.
 */
export function incomingPageDrivenProgress(
  startProgress: number,
  elapsedSeconds: number,
): number {
  "worklet";
  const safeStart = Math.min(1, Math.max(0, startProgress));
  const safeElapsed = Math.max(0, elapsedSeconds);
  const progressDurationScale =
    INCOMING_PAGE_SETTLE_DURATION_SECONDS /
    (1 - INCOMING_PAGE_PRELUDE_PROGRESS);
  const preludeRemaining =
    safeStart < INCOMING_PAGE_PRELUDE_PROGRESS
      ? (INCOMING_PAGE_PRELUDE_PROGRESS - safeStart) * progressDurationScale
      : 0;
  if (preludeRemaining > 0 && safeElapsed < preludeRemaining) {
    return (
      safeStart +
      (INCOMING_PAGE_PRELUDE_PROGRESS - safeStart) *
        (safeElapsed / preludeRemaining)
    );
  }

  const landingStart = Math.max(safeStart, INCOMING_PAGE_PRELUDE_PROGRESS);
  const landingDuration = incomingPageRemainingDurationSeconds(landingStart);
  if (landingDuration <= 0) {
    return 1;
  }
  const landingElapsed = Math.max(0, safeElapsed - preludeRemaining);
  const linearProgress = Math.min(1, landingElapsed / landingDuration);
  const easedProgress = 1 - (1 - linearProgress) ** 2;
  return landingStart + (1 - landingStart) * easedProgress;
}

export function automaticPageTurnSolverDurationSecondsForDirection(
  tuning: PageTurnTuning,
  direction: 1 | -1,
  maximumReleaseX = 0.8,
): number {
  if (direction === -1) {
    return incomingPageRemainingDurationSeconds(0);
  }
  const safeTuning = clampPageTurnTuning(tuning, maximumReleaseX);
  const propagationSpeed =
    turnPropagationSpeed(safeTuning) * PAGE_TURN_PROPAGATION_SPEED_SCALE;
  return (
    AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS +
    (safeTuning.releaseX + 1) / Math.max(0.1, propagationSpeed)
  );
}

export function automaticPageTurnSolverDurationSeconds(
  tuning: PageTurnTuning,
  maximumReleaseX = 0.8,
): number {
  return Math.max(
    automaticPageTurnSolverDurationSecondsForDirection(
      tuning,
      1,
      maximumReleaseX,
    ),
    automaticPageTurnSolverDurationSecondsForDirection(
      tuning,
      -1,
      maximumReleaseX,
    ),
  );
}
