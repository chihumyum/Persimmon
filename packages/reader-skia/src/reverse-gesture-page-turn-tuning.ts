import {
  DEFAULT_INCOMING_PAGE_TURN_TUNING,
  DEFAULT_PAGE_TURN_TUNING,
  clampIncomingPageTurnTuning,
  clampPageTurnTuning,
  type PageTurnTuning,
} from "@chihumyum/page-turn-core";

export interface ReverseGesturePageTurnTuning {
  readonly releaseX: number;
  readonly curvatureRelaxation: number;
  readonly incomingLandingStartProgress: number;
  readonly incomingRevealStartProgress: number;
  readonly incomingRevealEndProgress: number;
  readonly incomingDragProgressScale: number;
  readonly incomingDragProgressExponent: number;
  readonly incomingSettleDurationSeconds: number;
  readonly incomingSettleEasingPower: number;
  readonly incomingRevertDurationSeconds: number;
  readonly pageWeight: number;
  readonly commitThreshold: number;
  readonly minimumSpeedScale: number;
  readonly maximumSpeedScale: number;
  readonly velocityGain: number;
  readonly idleDecaySeconds: number;
}

export const DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING: ReverseGesturePageTurnTuning =
  {
    releaseX: 0.6,
    curvatureRelaxation: 10,
    incomingLandingStartProgress: 0.15,
    incomingRevealStartProgress: 0,
    incomingRevealEndProgress: 0.1,
    incomingDragProgressScale: 1,
    incomingDragProgressExponent: 1,
    incomingSettleDurationSeconds: 0.7,
    incomingSettleEasingPower: 2,
    incomingRevertDurationSeconds: 0.7,
    pageWeight: 1,
    commitThreshold: 0.15,
    minimumSpeedScale: 0.8,
    maximumSpeedScale: 5,
    velocityGain: 0.2,
    idleDecaySeconds: 0.1,
  };

const IOS_COMMIT_THRESHOLD_SCALE = 2 / 3;

export function normalizeReverseGesturePageTurnTuning(
  tuning: Partial<ReverseGesturePageTurnTuning> | undefined,
): ReverseGesturePageTurnTuning {
  const incoming = clampIncomingPageTurnTuning({
    ...DEFAULT_INCOMING_PAGE_TURN_TUNING,
    incomingLandingStartProgress:
      tuning?.incomingLandingStartProgress ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingLandingStartProgress,
    incomingRevealStartProgress:
      tuning?.incomingRevealStartProgress ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingRevealStartProgress,
    incomingRevealEndProgress:
      tuning?.incomingRevealEndProgress ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingRevealEndProgress,
    incomingDragProgressScale:
      tuning?.incomingDragProgressScale ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingDragProgressScale,
    incomingDragProgressExponent:
      tuning?.incomingDragProgressExponent ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingDragProgressExponent,
    incomingSettleDurationSeconds:
      tuning?.incomingSettleDurationSeconds ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingSettleDurationSeconds,
    incomingSettleEasingPower:
      tuning?.incomingSettleEasingPower ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingSettleEasingPower,
    incomingRevertDurationSeconds:
      tuning?.incomingRevertDurationSeconds ??
      DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingRevertDurationSeconds,
  });
  const core = clampPageTurnTuning(
    {
      ...DEFAULT_PAGE_TURN_TUNING,
      releaseX: clampFinite(
        tuning?.releaseX,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.releaseX,
        0.25,
        0.95,
      ),
      curvatureRelaxation: clampFinite(
        tuning?.curvatureRelaxation,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.curvatureRelaxation,
        2,
        20,
      ),
      pageWeight: clampFinite(
        tuning?.pageWeight,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.pageWeight,
        0.25,
        3,
      ),
      gestureCommitThreshold: clampFinite(
        tuning?.commitThreshold,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.commitThreshold,
        0.15,
        1.5,
      ),
      gestureMinimumSpeedScale: finiteOrDefault(
        tuning?.minimumSpeedScale,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.minimumSpeedScale,
      ),
      gestureMaximumSpeedScale: finiteOrDefault(
        tuning?.maximumSpeedScale,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.maximumSpeedScale,
      ),
      gestureVelocityGain: finiteOrDefault(
        tuning?.velocityGain,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.velocityGain,
      ),
      gestureIdleDecaySeconds: finiteOrDefault(
        tuning?.idleDecaySeconds,
        DEFAULT_REVERSE_GESTURE_PAGE_TURN_TUNING.idleDecaySeconds,
      ),
      ...incoming,
    },
    0.95,
  );
  return reverseGestureTuningFromCore(core);
}

export function normalizeReverseGesturePageTurnTuningForPlatform(
  tuning: Partial<ReverseGesturePageTurnTuning> | undefined,
  platform: string,
): ReverseGesturePageTurnTuning {
  const normalized = normalizeReverseGesturePageTurnTuning(tuning);
  if (platform !== "ios") {
    return normalized;
  }
  return normalizeReverseGesturePageTurnTuning({
    ...normalized,
    commitThreshold: normalized.commitThreshold * IOS_COMMIT_THRESHOLD_SCALE,
  });
}

export function reverseGestureTuningForCore(
  tuning: ReverseGesturePageTurnTuning,
): PageTurnTuning {
  return {
    ...DEFAULT_PAGE_TURN_TUNING,
    releaseX: tuning.releaseX,
    curvatureRelaxation: tuning.curvatureRelaxation,
    pageWeight: tuning.pageWeight,
    gestureCommitThreshold: tuning.commitThreshold,
    gestureMinimumSpeedScale: tuning.minimumSpeedScale,
    gestureMaximumSpeedScale: tuning.maximumSpeedScale,
    gestureVelocityGain: tuning.velocityGain,
    gestureIdleDecaySeconds: tuning.idleDecaySeconds,
    incomingLandingStartProgress: tuning.incomingLandingStartProgress,
    incomingRevealStartProgress: tuning.incomingRevealStartProgress,
    incomingRevealEndProgress: tuning.incomingRevealEndProgress,
    incomingDragProgressScale: tuning.incomingDragProgressScale,
    incomingDragProgressExponent: tuning.incomingDragProgressExponent,
    incomingSettleDurationSeconds: tuning.incomingSettleDurationSeconds,
    incomingSettleEasingPower: tuning.incomingSettleEasingPower,
    incomingRevertDurationSeconds: tuning.incomingRevertDurationSeconds,
  };
}

function reverseGestureTuningFromCore(
  tuning: PageTurnTuning,
): ReverseGesturePageTurnTuning {
  return {
    releaseX: tuning.releaseX,
    curvatureRelaxation: tuning.curvatureRelaxation,
    incomingLandingStartProgress:
      tuning.incomingLandingStartProgress ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingLandingStartProgress,
    incomingRevealStartProgress:
      tuning.incomingRevealStartProgress ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealStartProgress,
    incomingRevealEndProgress:
      tuning.incomingRevealEndProgress ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevealEndProgress,
    incomingDragProgressScale:
      tuning.incomingDragProgressScale ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingDragProgressScale,
    incomingDragProgressExponent:
      tuning.incomingDragProgressExponent ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingDragProgressExponent,
    incomingSettleDurationSeconds:
      tuning.incomingSettleDurationSeconds ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleDurationSeconds,
    incomingSettleEasingPower:
      tuning.incomingSettleEasingPower ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingSettleEasingPower,
    incomingRevertDurationSeconds:
      tuning.incomingRevertDurationSeconds ??
      DEFAULT_INCOMING_PAGE_TURN_TUNING.incomingRevertDurationSeconds,
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

function clampFinite(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, finiteOrDefault(value, fallback)));
}
