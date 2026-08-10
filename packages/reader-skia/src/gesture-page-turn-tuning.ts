import {
  clampPageTurnTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";

import { FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES } from "./page-turn-tuning-ranges";

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
  releaseX: 0.4,
  liftVelocity: 1,
  liftToLeft: 1,
  curvatureRelaxation: 10,
  pageWeight: 1,
  commitThreshold: 0.8,
  minimumSpeedScale: 1,
  maximumSpeedScale: 5,
  velocityGain: 0.2,
  idleDecaySeconds: 0.1,
};

const IOS_COMMIT_THRESHOLD_SCALE = 0.8;

export function normalizeGesturePageTurnTuning(
  tuning: Partial<GesturePageTurnTuning> | undefined,
): GesturePageTurnTuning {
  const core = clampPageTurnTuning(
    {
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
    },
    FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.releaseX.maximum,
  );
  return gestureTuningFromCore(core);
}

export function normalizeGesturePageTurnTuningForPlatform(
  tuning: Partial<GesturePageTurnTuning> | undefined,
  platform: string,
): GesturePageTurnTuning {
  const normalized = normalizeGesturePageTurnTuning(tuning);
  if (platform !== "ios") {
    return normalized;
  }
  return {
    ...normalized,
    commitThreshold: normalized.commitThreshold * IOS_COMMIT_THRESHOLD_SCALE,
  };
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
