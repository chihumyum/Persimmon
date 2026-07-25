import {
  DEFAULT_PAGE_TURN_TUNING,
  clampPageTurnTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";

export interface GesturePageTurnTuning {
  readonly releaseX: number;
  readonly liftVelocity: number;
  readonly liftToLeft: number;
  readonly curvatureRelaxation: number;
  readonly pageWeight: number;
  readonly commitThreshold: number;
  readonly minimumSpeedScale: number;
  readonly maximumSpeedScale: number;
  readonly velocityGain: number;
  readonly idleDecaySeconds: number;
}

export const DEFAULT_GESTURE_PAGE_TURN_TUNING: GesturePageTurnTuning = {
  releaseX: DEFAULT_PAGE_TURN_TUNING.releaseX,
  liftVelocity: DEFAULT_PAGE_TURN_TUNING.liftVelocity,
  liftToLeft: DEFAULT_PAGE_TURN_TUNING.liftToLeft,
  curvatureRelaxation: DEFAULT_PAGE_TURN_TUNING.curvatureRelaxation,
  pageWeight: DEFAULT_PAGE_TURN_TUNING.pageWeight,
  commitThreshold: DEFAULT_PAGE_TURN_TUNING.gestureCommitThreshold,
  minimumSpeedScale: DEFAULT_PAGE_TURN_TUNING.gestureMinimumSpeedScale,
  maximumSpeedScale: DEFAULT_PAGE_TURN_TUNING.gestureMaximumSpeedScale,
  velocityGain: DEFAULT_PAGE_TURN_TUNING.gestureVelocityGain,
  idleDecaySeconds: DEFAULT_PAGE_TURN_TUNING.gestureIdleDecaySeconds,
};

export function normalizeGesturePageTurnTuning(
  tuning: Partial<GesturePageTurnTuning> | undefined,
): GesturePageTurnTuning {
  const core = clampPageTurnTuning({
    releaseX: finiteOrDefault(
      tuning?.releaseX,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.releaseX,
    ),
    liftVelocity: finiteOrDefault(
      tuning?.liftVelocity,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.liftVelocity,
    ),
    liftToLeft: finiteOrDefault(
      tuning?.liftToLeft,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.liftToLeft,
    ),
    curvatureRelaxation: finiteOrDefault(
      tuning?.curvatureRelaxation,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.curvatureRelaxation,
    ),
    pageWeight: finiteOrDefault(
      tuning?.pageWeight,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.pageWeight,
    ),
    gestureCommitThreshold: finiteOrDefault(
      tuning?.commitThreshold,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.commitThreshold,
    ),
    gestureMinimumSpeedScale: finiteOrDefault(
      tuning?.minimumSpeedScale,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.minimumSpeedScale,
    ),
    gestureMaximumSpeedScale: finiteOrDefault(
      tuning?.maximumSpeedScale,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.maximumSpeedScale,
    ),
    gestureVelocityGain: finiteOrDefault(
      tuning?.velocityGain,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.velocityGain,
    ),
    gestureIdleDecaySeconds: finiteOrDefault(
      tuning?.idleDecaySeconds,
      DEFAULT_GESTURE_PAGE_TURN_TUNING.idleDecaySeconds,
    ),
  });
  return gestureTuningFromCore(core);
}

export function gestureTuningForCore(
  tuning: GesturePageTurnTuning,
): PageTurnTuning {
  return {
    releaseX: tuning.releaseX,
    liftVelocity: tuning.liftVelocity,
    liftToLeft: tuning.liftToLeft,
    curvatureRelaxation: tuning.curvatureRelaxation,
    pageWeight: tuning.pageWeight,
    gestureCommitThreshold: tuning.commitThreshold,
    gestureMinimumSpeedScale: tuning.minimumSpeedScale,
    gestureMaximumSpeedScale: tuning.maximumSpeedScale,
    gestureVelocityGain: tuning.velocityGain,
    gestureIdleDecaySeconds: tuning.idleDecaySeconds,
  };
}

function gestureTuningFromCore(tuning: PageTurnTuning): GesturePageTurnTuning {
  return {
    releaseX: tuning.releaseX,
    liftVelocity: tuning.liftVelocity,
    liftToLeft: tuning.liftToLeft,
    curvatureRelaxation: tuning.curvatureRelaxation,
    pageWeight: tuning.pageWeight,
    commitThreshold: tuning.gestureCommitThreshold,
    minimumSpeedScale: tuning.gestureMinimumSpeedScale,
    maximumSpeedScale: tuning.gestureMaximumSpeedScale,
    velocityGain: tuning.gestureVelocityGain,
    idleDecaySeconds: tuning.gestureIdleDecaySeconds,
  };
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
