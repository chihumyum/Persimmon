import {
  DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
  type ReaderClickPageTurnTuning,
  type ReaderGesturePageTurnTuning,
  type ReaderPageTurnTuning,
  type ReaderSettings,
} from "./types";

export function normalizeSettings(value: unknown): ReaderSettings {
  if (
    typeof value !== "object" ||
    value === null ||
    !("fontSize" in value) ||
    typeof value.fontSize !== "number" ||
    !Number.isFinite(value.fontSize)
  ) {
    return DEFAULT_READER_SETTINGS;
  }

  return {
    fontSize: Math.min(30, Math.max(16, Math.round(value.fontSize / 2) * 2)),
    layout:
      "layout" in value && value.layout === "spread" ? "spread" : "single",
    pageTurnTuning: normalizePageTurnTuning(
      "pageTurnTuning" in value ? value.pageTurnTuning : undefined,
    ),
  };
}

function normalizePageTurnTuning(value: unknown): ReaderPageTurnTuning {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_READER_PAGE_TURN_TUNING;
  }
  const clickSource =
    "click" in value && typeof value.click === "object" && value.click !== null
      ? value.click
      : value;
  const gestureSource =
    "gesture" in value &&
    typeof value.gesture === "object" &&
    value.gesture !== null
      ? value.gesture
      : undefined;
  return {
    click: normalizeClickPageTurnTuning(clickSource),
    gesture: normalizeGesturePageTurnTuning(gestureSource),
  };
}

function normalizeClickPageTurnTuning(
  value: object,
): ReaderClickPageTurnTuning {
  const legacyFlattenSpeed = boundedNumber(value, "flattenSpeed", 0.5, 2, 1);
  return {
    releaseX: boundedNumber(
      value,
      "releaseX",
      0.58,
      0.8,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.releaseX,
    ),
    liftVelocity: boundedNumber(
      value,
      "liftVelocity",
      0.7,
      1.8,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.liftVelocity,
    ),
    liftToLeft: boundedNumber(
      value,
      "liftToLeft",
      1.4,
      2.6,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.liftToLeft,
    ),
    curvatureRelaxation: boundedNumber(
      value,
      "curvatureRelaxation",
      3.5,
      14,
      7 * legacyFlattenSpeed,
    ),
    playbackSpeed: boundedNumber(
      value,
      "playbackSpeed",
      0.5,
      2,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.playbackSpeed,
    ),
  };
}

function normalizeGesturePageTurnTuning(
  value: object | undefined,
): ReaderGesturePageTurnTuning {
  if (!value) {
    return DEFAULT_READER_GESTURE_PAGE_TURN_TUNING;
  }
  const minimumSpeedScale = boundedNumber(
    value,
    "minimumSpeedScale",
    0.5,
    1.5,
    DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.minimumSpeedScale,
  );
  return {
    releaseX: boundedNumber(
      value,
      "releaseX",
      0.58,
      0.8,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.releaseX,
    ),
    liftVelocity: boundedNumber(
      value,
      "liftVelocity",
      0.7,
      1.8,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.liftVelocity,
    ),
    liftToLeft: boundedNumber(
      value,
      "liftToLeft",
      1.4,
      2.6,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.liftToLeft,
    ),
    curvatureRelaxation: boundedNumber(
      value,
      "curvatureRelaxation",
      3.5,
      14,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.curvatureRelaxation,
    ),
    pageWeight: boundedNumber(
      value,
      "pageWeight",
      0.5,
      1.8,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.pageWeight,
    ),
    commitThreshold: boundedNumber(
      value,
      "commitThreshold",
      0.4,
      1.2,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.commitThreshold,
    ),
    minimumSpeedScale,
    maximumSpeedScale: boundedNumber(
      value,
      "maximumSpeedScale",
      minimumSpeedScale,
      3,
      Math.max(
        minimumSpeedScale,
        DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.maximumSpeedScale,
      ),
    ),
    velocityGain: boundedNumber(
      value,
      "velocityGain",
      0.1,
      1.2,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.velocityGain,
    ),
    idleDecaySeconds: boundedNumber(
      value,
      "idleDecaySeconds",
      0.03,
      0.2,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.idleDecaySeconds,
    ),
  };
}

function boundedNumber(
  value: object,
  key: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const candidate =
    key in value ? (value as Record<string, unknown>)[key] : undefined;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? Math.min(maximum, Math.max(minimum, candidate))
    : fallback;
}
