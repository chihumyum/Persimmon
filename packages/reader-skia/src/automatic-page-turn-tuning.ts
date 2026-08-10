import {
  DEFAULT_PAGE_TURN_TUNING,
  clampPageTurnTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";

import { FORWARD_CLICK_PAGE_TURN_TUNING_RANGES } from "./page-turn-tuning-ranges";

export interface AutomaticPageTurnTuning {
  readonly releaseX: number;
  readonly liftVelocity: number;
  readonly liftToLeft: number;
  readonly curvatureRelaxation: number;
  readonly playbackSpeed: number;
}

export const AUTOMATIC_PAGE_TURN_MAXIMUM_RELEASE_X =
  FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.releaseX.maximum;

export const DEFAULT_AUTOMATIC_PAGE_TURN_TUNING: AutomaticPageTurnTuning = {
  releaseX: 0.9,
  liftVelocity: 0.5,
  liftToLeft: 4,
  curvatureRelaxation: 10,
  playbackSpeed: 1,
};

export function normalizeAutomaticPageTurnTuning(
  tuning: Partial<AutomaticPageTurnTuning> | undefined,
): AutomaticPageTurnTuning {
  const core = clampPageTurnTuning(
    {
      releaseX: finiteOrDefault(
        tuning?.releaseX,
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.releaseX,
      ),
      liftVelocity: finiteOrDefault(
        tuning?.liftVelocity,
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftVelocity,
      ),
      liftToLeft: finiteOrDefault(
        tuning?.liftToLeft,
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftToLeft,
      ),
      curvatureRelaxation: finiteOrDefault(
        tuning?.curvatureRelaxation,
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.curvatureRelaxation,
      ),
      pageWeight: DEFAULT_PAGE_TURN_TUNING.pageWeight,
      gestureCommitThreshold: DEFAULT_PAGE_TURN_TUNING.gestureCommitThreshold,
      gestureMinimumSpeedScale:
        DEFAULT_PAGE_TURN_TUNING.gestureMinimumSpeedScale,
      gestureMaximumSpeedScale:
        DEFAULT_PAGE_TURN_TUNING.gestureMaximumSpeedScale,
      gestureVelocityGain: DEFAULT_PAGE_TURN_TUNING.gestureVelocityGain,
      gestureIdleDecaySeconds: DEFAULT_PAGE_TURN_TUNING.gestureIdleDecaySeconds,
    },
    AUTOMATIC_PAGE_TURN_MAXIMUM_RELEASE_X,
  );
  const requestedPlaybackSpeed =
    tuning?.playbackSpeed ?? DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.playbackSpeed;
  return {
    releaseX: core.releaseX,
    liftVelocity: core.liftVelocity,
    liftToLeft: core.liftToLeft,
    curvatureRelaxation: core.curvatureRelaxation,
    playbackSpeed: Number.isFinite(requestedPlaybackSpeed)
      ? Math.min(
          FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.playbackSpeed.maximum,
          Math.max(
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.playbackSpeed.minimum,
            requestedPlaybackSpeed,
          ),
        )
      : DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.playbackSpeed,
  };
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function automaticTuningForCore(
  tuning: AutomaticPageTurnTuning,
): PageTurnTuning {
  return {
    releaseX: tuning.releaseX,
    liftVelocity: tuning.liftVelocity,
    liftToLeft: tuning.liftToLeft,
    curvatureRelaxation: tuning.curvatureRelaxation,
    pageWeight: DEFAULT_PAGE_TURN_TUNING.pageWeight,
    gestureCommitThreshold: DEFAULT_PAGE_TURN_TUNING.gestureCommitThreshold,
    gestureMinimumSpeedScale: DEFAULT_PAGE_TURN_TUNING.gestureMinimumSpeedScale,
    gestureMaximumSpeedScale: DEFAULT_PAGE_TURN_TUNING.gestureMaximumSpeedScale,
    gestureVelocityGain: DEFAULT_PAGE_TURN_TUNING.gestureVelocityGain,
    gestureIdleDecaySeconds: DEFAULT_PAGE_TURN_TUNING.gestureIdleDecaySeconds,
  };
}
