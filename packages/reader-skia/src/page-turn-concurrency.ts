import {
  automaticPageTurnSolverDurationSeconds,
  automaticPageTurnSolverDurationSecondsForDirection,
} from "@persimmon/page-turn-core";

import {
  automaticTuningForCore,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";

export const PAGE_TURN_LANE_HARD_LIMIT = 11;
export const PAGE_TURN_GESTURE_LANE_RESERVE = 1;
export const PAGE_TURN_TAP_LANE_HEADROOM = 8;
export const PAGE_TURN_BURST_TARGET_DURATION_MS = 160;
const PAGE_TURN_BURST_MAX_PLAYBACK_SPEED = 8;

export interface PageTurnConcurrency {
  readonly estimatedTapDurationMs: number;
  readonly minimumTurnIntervalMs: number;
  readonly maximumConcurrentTapTurns: number;
  readonly maximumConcurrentTurns: number;
}

/**
 * Sizes the active part of the fixed native lane pool for burst-compressed tap
 * animations. A lone turn still honors the reader's requested playback speed,
 * but once taps overlap the native drivers give every sheet the same
 * PAGE_TURN_BURST_TARGET_DURATION_MS visual lifetime. A 160 ms sheet remains
 * visible for roughly ten 60 Hz frames while overlapping the next 100 ms
 * launch. Eight headroom lanes absorb cold
 * texture, presentation, and RN outcome tail latency, and one lane stays
 * reserved for a gesture.
 */
export function calculatePageTurnConcurrency(
  tuning: AutomaticPageTurnTuning,
  startIntervalMs: number,
  maximumReleaseX = 0.8,
): PageTurnConcurrency {
  const estimatedTapDurationMs = estimateAutomaticPageTurnDurationMs(
    tuning,
    undefined,
    maximumReleaseX,
  );
  const burstTapDurationMs = Math.min(
    estimatedTapDurationMs,
    PAGE_TURN_BURST_TARGET_DURATION_MS,
  );
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
    Math.ceil(burstTapDurationMs / steadyStateTapLanes),
  );
  const maximumConcurrentTapTurns = Math.min(
    tapLaneLimit,
    Math.max(
      1,
      Math.ceil(burstTapDurationMs / minimumTurnIntervalMs) +
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

/**
 * Effective playback speed used only while two or more automatic turns
 * overlap. It never slows a fast custom animation down.
 */
export function burstPageTurnPlaybackSpeed(
  tuning: AutomaticPageTurnTuning,
  _olderTurnDepth = 0,
  maximumReleaseX = 0.8,
): number {
  const estimatedDurationMs = estimateAutomaticPageTurnDurationMs(
    tuning,
    undefined,
    maximumReleaseX,
  );
  if (estimatedDurationMs <= PAGE_TURN_BURST_TARGET_DURATION_MS) {
    return tuning.playbackSpeed;
  }
  return Math.min(
    PAGE_TURN_BURST_MAX_PLAYBACK_SPEED,
    tuning.playbackSpeed *
      (estimatedDurationMs / PAGE_TURN_BURST_TARGET_DURATION_MS),
  );
}

export function estimateAutomaticPageTurnDurationMs(
  tuning: AutomaticPageTurnTuning,
  direction?: 1 | -1,
  maximumReleaseX = 0.8,
): number {
  const coreTuning = automaticTuningForCore(tuning);
  const solverDurationSeconds =
    direction === undefined
      ? automaticPageTurnSolverDurationSeconds(coreTuning, maximumReleaseX)
      : automaticPageTurnSolverDurationSecondsForDirection(
          coreTuning,
          direction,
          maximumReleaseX,
        );
  return Math.ceil(
    (solverDurationSeconds / Math.max(0.01, tuning.playbackSpeed)) * 1000,
  );
}
