import {
  DEFAULT_INCOMING_PAGE_TURN_TUNING,
  DEFAULT_PAGE_TURN_TUNING,
  clampIncomingPageTurnTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";

export interface ReverseAutomaticPageTurnTuning {
  readonly releaseX: number;
  readonly curvatureRelaxation: number;
  readonly incomingLandingStartProgress: number;
  readonly incomingRevealStartProgress: number;
  readonly incomingRevealEndProgress: number;
  readonly incomingSettleDurationSeconds: number;
  readonly incomingSettleEasingPower: number;
  readonly playbackSpeed: number;
}

export const DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING: ReverseAutomaticPageTurnTuning =
  {
    releaseX: 0.4,
    curvatureRelaxation: 10,
    incomingLandingStartProgress: 0.15,
    incomingRevealStartProgress: 0,
    incomingRevealEndProgress: 0.18,
    incomingSettleDurationSeconds: 0.7,
    incomingSettleEasingPower: 3,
    playbackSpeed: 1,
  };

export function normalizeReverseAutomaticPageTurnTuning(
  tuning: Partial<ReverseAutomaticPageTurnTuning> | undefined,
): ReverseAutomaticPageTurnTuning {
  const incoming = clampIncomingPageTurnTuning({
    ...DEFAULT_INCOMING_PAGE_TURN_TUNING,
    incomingLandingStartProgress:
      tuning?.incomingLandingStartProgress ??
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.incomingLandingStartProgress,
    incomingRevealStartProgress:
      tuning?.incomingRevealStartProgress ??
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.incomingRevealStartProgress,
    incomingRevealEndProgress:
      tuning?.incomingRevealEndProgress ??
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.incomingRevealEndProgress,
    incomingSettleDurationSeconds:
      tuning?.incomingSettleDurationSeconds ??
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.incomingSettleDurationSeconds,
    incomingSettleEasingPower:
      tuning?.incomingSettleEasingPower ??
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.incomingSettleEasingPower,
  });
  return {
    releaseX: clampFinite(
      tuning?.releaseX,
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.releaseX,
      0.25,
      0.95,
    ),
    curvatureRelaxation: clampFinite(
      tuning?.curvatureRelaxation,
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.curvatureRelaxation,
      2,
      20,
    ),
    incomingLandingStartProgress: incoming.incomingLandingStartProgress,
    incomingRevealStartProgress: incoming.incomingRevealStartProgress,
    incomingRevealEndProgress: incoming.incomingRevealEndProgress,
    incomingSettleDurationSeconds: incoming.incomingSettleDurationSeconds,
    incomingSettleEasingPower: incoming.incomingSettleEasingPower,
    playbackSpeed: clampFinite(
      tuning?.playbackSpeed,
      DEFAULT_REVERSE_AUTOMATIC_PAGE_TURN_TUNING.playbackSpeed,
      0.25,
      3,
    ),
  };
}

export function reverseAutomaticTuningForCore(
  tuning: ReverseAutomaticPageTurnTuning,
): PageTurnTuning {
  return {
    ...DEFAULT_PAGE_TURN_TUNING,
    releaseX: tuning.releaseX,
    curvatureRelaxation: tuning.curvatureRelaxation,
    incomingLandingStartProgress: tuning.incomingLandingStartProgress,
    incomingRevealStartProgress: tuning.incomingRevealStartProgress,
    incomingRevealEndProgress: tuning.incomingRevealEndProgress,
    incomingSettleDurationSeconds: tuning.incomingSettleDurationSeconds,
    incomingSettleEasingPower: tuning.incomingSettleEasingPower,
  };
}

function clampFinite(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const safeValue =
    value !== undefined && Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, safeValue));
}
