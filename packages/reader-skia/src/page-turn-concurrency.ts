import { automaticPageTurnSolverDurationSeconds } from "@persimmon/page-turn-core";

import {
  automaticTuningForCore,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";

export const PAGE_TURN_LANE_HARD_LIMIT = 20;
export const PAGE_TURN_GESTURE_LANE_RESERVE = 1;
export const PAGE_TURN_TAP_LANE_HEADROOM_MULTIPLIER = 2;

export interface PageTurnConcurrency {
  readonly estimatedTapDurationMs: number;
  readonly maximumConcurrentTapTurns: number;
  readonly maximumConcurrentTurns: number;
}

/**
 * Sizes the active part of the fixed native lane pool from the amount of time
 * that successive click turns can overlap. Keep a second set of tap lanes as
 * timing headroom so delayed completion cannot turn a uniformly throttled
 * input stream into visible bursts. One additional lane stays outside the
 * click allowance so a released gesture or native handoff is not starved.
 */
export function calculatePageTurnConcurrency(
  tuning: AutomaticPageTurnTuning,
  startIntervalMs: number,
): PageTurnConcurrency {
  const estimatedTapDurationMs = estimateAutomaticPageTurnDurationMs(tuning);
  const safeIntervalMs =
    Number.isFinite(startIntervalMs) && startIntervalMs > 0
      ? startIntervalMs
      : 1;
  const maximumConcurrentTapTurns = Math.min(
    PAGE_TURN_LANE_HARD_LIMIT - PAGE_TURN_GESTURE_LANE_RESERVE,
    Math.max(
      1,
      Math.ceil(estimatedTapDurationMs / safeIntervalMs) *
        PAGE_TURN_TAP_LANE_HEADROOM_MULTIPLIER,
    ),
  );
  return {
    estimatedTapDurationMs,
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
