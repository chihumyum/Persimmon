import {
  DEFAULT_PAGE_TURN_TUNING,
  clampPageTurnTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";

export interface AutomaticPageTurnTuning {
  readonly releaseX: number;
  readonly liftVelocity: number;
  readonly liftToLeft: number;
  readonly curvatureRelaxation: number;
  readonly playbackSpeed: number;
}

export const DEFAULT_AUTOMATIC_PAGE_TURN_TUNING: AutomaticPageTurnTuning = {
  releaseX: DEFAULT_PAGE_TURN_TUNING.releaseX,
  liftVelocity: DEFAULT_PAGE_TURN_TUNING.liftVelocity,
  liftToLeft: DEFAULT_PAGE_TURN_TUNING.liftToLeft,
  curvatureRelaxation: DEFAULT_PAGE_TURN_TUNING.curvatureRelaxation,
  playbackSpeed: 1,
};

export function normalizeAutomaticPageTurnTuning(
  tuning: Partial<AutomaticPageTurnTuning> | undefined,
): AutomaticPageTurnTuning {
  const core = clampPageTurnTuning({
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
    gestureMinimumSpeedScale: DEFAULT_PAGE_TURN_TUNING.gestureMinimumSpeedScale,
    gestureMaximumSpeedScale: DEFAULT_PAGE_TURN_TUNING.gestureMaximumSpeedScale,
    gestureVelocityGain: DEFAULT_PAGE_TURN_TUNING.gestureVelocityGain,
    gestureIdleDecaySeconds: DEFAULT_PAGE_TURN_TUNING.gestureIdleDecaySeconds,
  });
  const requestedPlaybackSpeed =
    tuning?.playbackSpeed ?? DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.playbackSpeed;
  return {
    releaseX: core.releaseX,
    liftVelocity: core.liftVelocity,
    liftToLeft: core.liftToLeft,
    curvatureRelaxation: core.curvatureRelaxation,
    playbackSpeed: Number.isFinite(requestedPlaybackSpeed)
      ? Math.min(2, Math.max(0.5, requestedPlaybackSpeed))
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
