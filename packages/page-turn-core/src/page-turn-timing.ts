import {
  clampPageTurnTuning,
  DEFAULT_INCOMING_PAGE_TURN_TUNING,
  MAX_PAGE_TURN_RELEASE_X,
  turnPropagationSpeed,
  type IncomingPageTurnTuning,
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

export function incomingPageShapeProgress(
  progress: number,
  tuning: Partial<IncomingPageTurnTuning> = DEFAULT_INCOMING_PAGE_TURN_TUNING,
): number {
  "worklet";
  const safeProgress = Math.min(1, Math.max(0, progress));
  const revealEndValue = tuning.incomingRevealEndProgress;
  const revealEnd =
    revealEndValue !== undefined && Number.isFinite(revealEndValue)
      ? revealEndValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealEndProgress;
  const landingStartValue = tuning.incomingLandingStartProgress;
  const landingStart =
    landingStartValue !== undefined && Number.isFinite(landingStartValue)
      ? landingStartValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingLandingStartProgress;
  if (safeProgress <= revealEnd) {
    return landingStart;
  }
  const landingProgress =
    (safeProgress - revealEnd) / Math.max(0.000001, 1 - revealEnd);
  return landingStart + (1 - landingStart) * landingProgress;
}

export function incomingPageRevealProgress(
  progress: number,
  tuning: Partial<IncomingPageTurnTuning> = DEFAULT_INCOMING_PAGE_TURN_TUNING,
): number {
  "worklet";
  const safeProgress = Math.min(1, Math.max(0, progress));
  const revealStartValue = tuning.incomingRevealStartProgress;
  const revealStart =
    revealStartValue !== undefined && Number.isFinite(revealStartValue)
      ? revealStartValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealStartProgress;
  const revealEndValue = tuning.incomingRevealEndProgress;
  const revealEnd = Math.max(
    revealStart + 0.000001,
    revealEndValue !== undefined && Number.isFinite(revealEndValue)
      ? revealEndValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealEndProgress,
  );
  return Math.min(
    1,
    Math.max(0, (safeProgress - revealStart) / (revealEnd - revealStart)),
  );
}

export function incomingPageDragProgress(
  progress: number,
  tuning: Partial<IncomingPageTurnTuning> = DEFAULT_INCOMING_PAGE_TURN_TUNING,
): number {
  "worklet";
  const safeProgress = Math.min(1, Math.max(0, progress));
  const scaleValue = tuning.incomingDragProgressScale;
  const scale =
    scaleValue !== undefined && Number.isFinite(scaleValue)
      ? scaleValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingDragProgressScale;
  const exponentValue = tuning.incomingDragProgressExponent;
  const exponent =
    exponentValue !== undefined && Number.isFinite(exponentValue)
      ? exponentValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingDragProgressExponent;
  return Math.min(1, Math.max(0, safeProgress ** exponent * scale));
}

export function incomingPageRemainingDurationSeconds(
  progress: number,
  tuning: Partial<IncomingPageTurnTuning> = DEFAULT_INCOMING_PAGE_TURN_TUNING,
): number {
  "worklet";
  const revealEndValue = tuning.incomingRevealEndProgress;
  const revealEnd =
    revealEndValue !== undefined && Number.isFinite(revealEndValue)
      ? revealEndValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealEndProgress;
  const settleDurationValue = tuning.incomingSettleDurationSeconds;
  const settleDuration =
    settleDurationValue !== undefined && Number.isFinite(settleDurationValue)
      ? settleDurationValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleDurationSeconds;
  return (
    (settleDuration * (1 - Math.min(1, Math.max(0, progress)))) /
    Math.max(0.000001, 1 - revealEnd)
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
  tuning: Partial<IncomingPageTurnTuning> = DEFAULT_INCOMING_PAGE_TURN_TUNING,
): number {
  "worklet";
  const safeStart = Math.min(1, Math.max(0, startProgress));
  const safeElapsed = Math.max(0, elapsedSeconds);
  const revealEndValue = tuning.incomingRevealEndProgress;
  const revealEnd =
    revealEndValue !== undefined && Number.isFinite(revealEndValue)
      ? revealEndValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealEndProgress;
  const settleDurationValue = tuning.incomingSettleDurationSeconds;
  const settleDuration =
    settleDurationValue !== undefined && Number.isFinite(settleDurationValue)
      ? settleDurationValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleDurationSeconds;
  const easingPowerValue = tuning.incomingSettleEasingPower;
  const easingPower =
    easingPowerValue !== undefined && Number.isFinite(easingPowerValue)
      ? easingPowerValue
      : DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleEasingPower;
  const progressDurationScale =
    settleDuration / Math.max(0.000001, 1 - revealEnd);
  const preludeRemaining =
    safeStart < revealEnd ? (revealEnd - safeStart) * progressDurationScale : 0;
  if (preludeRemaining > 0 && safeElapsed < preludeRemaining) {
    return (
      safeStart + (revealEnd - safeStart) * (safeElapsed / preludeRemaining)
    );
  }

  const landingStart = Math.max(safeStart, revealEnd);
  const landingDuration = incomingPageRemainingDurationSeconds(
    landingStart,
    tuning,
  );
  if (landingDuration <= 0) {
    return 1;
  }
  const landingElapsed = Math.max(0, safeElapsed - preludeRemaining);
  const linearProgress = Math.min(1, landingElapsed / landingDuration);
  const easedProgress = 1 - (1 - linearProgress) ** easingPower;
  return landingStart + (1 - landingStart) * easedProgress;
}

export function automaticPageTurnSolverDurationSecondsForDirection(
  tuning: PageTurnTuning,
  direction: 1 | -1,
  maximumReleaseX = MAX_PAGE_TURN_RELEASE_X,
): number {
  if (direction === -1) {
    return incomingPageRemainingDurationSeconds(0, tuning);
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
  maximumReleaseX = MAX_PAGE_TURN_RELEASE_X,
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
