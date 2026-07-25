import { automaticPageTurnSolverDurationSeconds } from "@persimmon/page-turn-core";

import {
  automaticTuningForCore,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";

export const PAGE_TURN_LANE_HARD_LIMIT = 8;
export const PAGE_TURN_GESTURE_LANE_RESERVE = 1;
export const PAGE_TURN_TAP_LANE_HEADROOM = 2;

export interface PageTurnConcurrency {
  readonly estimatedTapDurationMs: number;
  readonly minimumTurnIntervalMs: number;
  readonly maximumConcurrentTapTurns: number;
  readonly maximumConcurrentTurns: number;
}

/**
 * Sizes the active part of the fixed native lane pool from the amount of time
 * that successive click turns can overlap. Two extra tap lanes absorb delayed
 * completion without doubling the whole pool, and one lane stays outside the
 * click allowance so a released gesture or native handoff is not starved. If
 * slow tuning would overflow that fixed pool, spread starts uniformly over the
 * animation duration instead of accepting a burst and then stalling.
 */
export function calculatePageTurnConcurrency(
  tuning: AutomaticPageTurnTuning,
  startIntervalMs: number,
): PageTurnConcurrency {
  const estimatedTapDurationMs = estimateAutomaticPageTurnDurationMs(tuning);
  const requestedIntervalMs =
    Number.isFinite(startIntervalMs) && startIntervalMs > 0
      ? startIntervalMs
      : 1;
  const tapLaneLimit =
    PAGE_TURN_LANE_HARD_LIMIT - PAGE_TURN_GESTURE_LANE_RESERVE;
  const steadyStateTapLanes = Math.max(
    1,
    tapLaneLimit - PAGE_TURN_TAP_LANE_HEADROOM,
  );
  const minimumTurnIntervalMs = Math.max(
    requestedIntervalMs,
    Math.ceil(estimatedTapDurationMs / steadyStateTapLanes),
  );
  const maximumConcurrentTapTurns = Math.min(
    tapLaneLimit,
    Math.max(
      1,
      Math.ceil(estimatedTapDurationMs / minimumTurnIntervalMs) +
        PAGE_TURN_TAP_LANE_HEADROOM,
    ),
  );
  return {
    estimatedTapDurationMs,
    minimumTurnIntervalMs,
    maximumConcurrentTapTurns,
    maximumConcurrentTurns: Math.min(
      PAGE_TURN_LANE_HARD_LIMIT,
      maximumConcurrentTapTurns + PAGE_TURN_GESTURE_LANE_RESERVE,
    ),
  };
}

export function estimateAutomaticPageTurnDurationMs(
  tuning: AutomaticPageTurnTuning,
): number {
  const coreTuning = automaticTuningForCore(tuning);
  const solverDurationSeconds =
    automaticPageTurnSolverDurationSeconds(coreTuning);
  return Math.ceil(
    (solverDurationSeconds / Math.max(0.01, tuning.playbackSpeed)) * 1000,
  );
}
