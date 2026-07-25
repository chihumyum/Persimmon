import {
  clampPageTurnTuning,
  turnPropagationSpeed,
  type PageTurnTuning,
} from "./page-turn-gesture";

export const AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS = 0.12;
export const INCOMING_PAGE_SETTLE_DURATION_SECONDS = 0.52;
export const PAGE_TURN_PROPAGATION_SPEED_SCALE = 1.15;

export function automaticPageTurnSolverDurationSeconds(
  tuning: PageTurnTuning,
): number {
  const safeTuning = clampPageTurnTuning(tuning);
  const propagationSpeed =
    turnPropagationSpeed(safeTuning) * PAGE_TURN_PROPAGATION_SPEED_SCALE;
  const outgoingDurationSeconds =
    AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS +
    (safeTuning.releaseX + 1) / Math.max(0.1, propagationSpeed);
  return Math.max(
    outgoingDurationSeconds,
    INCOMING_PAGE_SETTLE_DURATION_SECONDS,
  );
}
