import { normalizeReaderFontSettings } from "@persimmon/font-core";
import {
  FORWARD_CLICK_PAGE_TURN_TUNING_RANGES,
  FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES,
} from "@persimmon/reader-skia/page-turn-tuning-ranges";

import {
  DEFAULT_READER_APPEARANCE,
  DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
  type ReaderAppearanceSettings,
  type ReaderClickPageTurnTuning,
  type ReaderColorMode,
  type ReaderDirectionalPageTurnTuning,
  type ReaderGesturePageTurnTuning,
  type ReaderPageTurnTuning,
  type ReaderReverseClickPageTurnTuning,
  type ReaderReverseGesturePageTurnTuning,
  DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING,
  type ReaderProgressDisplay,
  type ReaderSettings,
  type ReaderTextAlignment,
  type ReaderThemeName,
} from "./types";
import { READER_TYPOGRAPHY_RANGES } from "./reader-typography-controls";

export function normalizeSettings(value: unknown): ReaderSettings {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_READER_SETTINGS;
  }

  const appearanceSource =
    "appearance" in value &&
    typeof value.appearance === "object" &&
    value.appearance !== null
      ? value.appearance
      : value;

  return {
    appearance: normalizeAppearance(appearanceSource),
    layout:
      "layout" in value && value.layout === "spread" ? "spread" : "single",
    pageTurnAnimation:
      "pageTurnAnimation" in value && value.pageTurnAnimation === "none"
        ? "none"
        : "natural",
    rapidPageTurnEnabled:
      !("rapidPageTurnEnabled" in value) ||
      typeof value.rapidPageTurnEnabled !== "boolean"
        ? DEFAULT_READER_SETTINGS.rapidPageTurnEnabled
        : value.rapidPageTurnEnabled,
    pageTurnTuning: normalizePageTurnTuning(
      "pageTurnTuning" in value ? value.pageTurnTuning : undefined,
    ),
  };
}

function normalizeAppearance(value: object): ReaderAppearanceSettings {
  const fontSize = READER_TYPOGRAPHY_RANGES.fontSize;
  const lineHeight = READER_TYPOGRAPHY_RANGES.lineHeight;
  const paragraphSpacing = READER_TYPOGRAPHY_RANGES.paragraphSpacing;
  const horizontalMargin = READER_TYPOGRAPHY_RANGES.horizontalMargin;
  return {
    theme: readerTheme(value),
    colorMode: readerColorMode(value),
    font: normalizeReaderFontSettings(
      "font" in value ? value.font : undefined,
      "fontFamily" in value ? value.fontFamily : undefined,
    ),
    fontSize: steppedNumber(
      value,
      "fontSize",
      fontSize.minimum,
      fontSize.maximum,
      fontSize.step,
      DEFAULT_READER_APPEARANCE.fontSize,
    ),
    lineHeight: steppedNumber(
      value,
      "lineHeight",
      lineHeight.minimum,
      lineHeight.maximum,
      lineHeight.step,
      DEFAULT_READER_APPEARANCE.lineHeight,
    ),
    paragraphSpacing: steppedNumber(
      value,
      "paragraphSpacing",
      paragraphSpacing.minimum,
      paragraphSpacing.maximum,
      paragraphSpacing.step,
      DEFAULT_READER_APPEARANCE.paragraphSpacing,
    ),
    horizontalMargin: steppedNumber(
      value,
      "horizontalMargin",
      horizontalMargin.minimum,
      horizontalMargin.maximum,
      horizontalMargin.step,
      DEFAULT_READER_APPEARANCE.horizontalMargin,
    ),
    textAlignment: readerTextAlignment(value),
    progressDisplay: readerProgressDisplay(value),
  };
}

function readerTextAlignment(value: object): ReaderTextAlignment {
  if (!("textAlignment" in value)) {
    return DEFAULT_READER_APPEARANCE.textAlignment;
  }
  switch (value.textAlignment) {
    case "start":
    case "justify":
    case "end":
      return value.textAlignment;
    default:
      return "book";
  }
}

function readerTheme(value: object): ReaderThemeName {
  return "theme" in value && value.theme === "cool" ? "cool" : "warm";
}

function readerColorMode(value: object): ReaderColorMode {
  if (!("colorMode" in value)) {
    return DEFAULT_READER_APPEARANCE.colorMode;
  }
  switch (value.colorMode) {
    case "light":
    case "dark":
      return value.colorMode;
    default:
      return "system";
  }
}

function readerProgressDisplay(value: object): ReaderProgressDisplay {
  if (!("progressDisplay" in value)) {
    return DEFAULT_READER_APPEARANCE.progressDisplay;
  }
  switch (value.progressDisplay) {
    case "header":
    case "both":
    case "hidden":
      return value.progressDisplay;
    default:
      return "footer";
  }
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
    click: normalizeDirectionalClickPageTurnTuning(clickSource),
    gesture: normalizeDirectionalGesturePageTurnTuning(gestureSource),
  };
}

function normalizeDirectionalClickPageTurnTuning(
  value: object,
): ReaderDirectionalPageTurnTuning<
  ReaderClickPageTurnTuning,
  ReaderReverseClickPageTurnTuning
> {
  const forwardSource = nestedObject(value, "forward") ?? value;
  const backwardSource = nestedObject(value, "backward") ?? value;
  return {
    forward: normalizeClickPageTurnTuning(forwardSource),
    backward: normalizeReverseClickPageTurnTuning(backwardSource),
  };
}

function normalizeReverseClickPageTurnTuning(
  value: object,
): ReaderReverseClickPageTurnTuning {
  const revealStart = boundedNumber(
    value,
    "incomingRevealStartProgress",
    0,
    0.85,
    DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.incomingRevealStartProgress,
  );
  return {
    releaseX: boundedNumber(
      value,
      "releaseX",
      0.25,
      0.95,
      DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.releaseX,
    ),
    curvatureRelaxation: boundedNumber(
      value,
      "curvatureRelaxation",
      2,
      20,
      DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.curvatureRelaxation,
    ),
    incomingLandingStartProgress: boundedNumber(
      value,
      "incomingLandingStartProgress",
      0.05,
      0.85,
      DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.incomingLandingStartProgress,
    ),
    incomingRevealStartProgress: revealStart,
    incomingRevealEndProgress: boundedNumber(
      value,
      "incomingRevealEndProgress",
      revealStart + 0.02,
      0.95,
      Math.max(
        revealStart + 0.02,
        DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.incomingRevealEndProgress,
      ),
    ),
    incomingSettleDurationSeconds: boundedNumber(
      value,
      "incomingSettleDurationSeconds",
      0.15,
      1.5,
      DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.incomingSettleDurationSeconds,
    ),
    incomingSettleEasingPower: boundedNumber(
      value,
      "incomingSettleEasingPower",
      0.75,
      6,
      DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.incomingSettleEasingPower,
    ),
    playbackSpeed: boundedNumber(
      value,
      "playbackSpeed",
      0.25,
      3,
      DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING.playbackSpeed,
    ),
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
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.releaseX.minimum,
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.releaseX.maximum,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.releaseX,
    ),
    liftVelocity: boundedNumber(
      value,
      "liftVelocity",
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftVelocity.minimum,
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftVelocity.maximum,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.liftVelocity,
    ),
    liftToLeft: boundedNumber(
      value,
      "liftToLeft",
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftToLeft.minimum,
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftToLeft.maximum,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.liftToLeft,
    ),
    curvatureRelaxation: boundedNumber(
      value,
      "curvatureRelaxation",
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.curvatureRelaxation.minimum,
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.curvatureRelaxation.maximum,
      DEFAULT_READER_CLICK_PAGE_TURN_TUNING.curvatureRelaxation *
        legacyFlattenSpeed,
    ),
    playbackSpeed: boundedNumber(
      value,
      "playbackSpeed",
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.playbackSpeed.minimum,
      FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.playbackSpeed.maximum,
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
    FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale.minimum,
    FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale.maximum,
    DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.minimumSpeedScale,
  );
  return {
    releaseX: boundedNumber(
      value,
      "releaseX",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.releaseX.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.releaseX.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.releaseX,
    ),
    liftVelocity: boundedNumber(
      value,
      "liftVelocity",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftVelocity.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftVelocity.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.liftVelocity,
    ),
    liftToLeft: boundedNumber(
      value,
      "liftToLeft",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftToLeft.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftToLeft.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.liftToLeft,
    ),
    curvatureRelaxation: boundedNumber(
      value,
      "curvatureRelaxation",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.curvatureRelaxation.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.curvatureRelaxation.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.curvatureRelaxation,
    ),
    pageWeight: boundedNumber(
      value,
      "pageWeight",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.pageWeight.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.pageWeight.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.pageWeight,
    ),
    commitThreshold: boundedNumber(
      value,
      "commitThreshold",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.commitThreshold.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.commitThreshold.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.commitThreshold,
    ),
    minimumSpeedScale,
    maximumSpeedScale: boundedNumber(
      value,
      "maximumSpeedScale",
      minimumSpeedScale,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.maximumSpeedScale.maximum,
      Math.max(
        minimumSpeedScale,
        DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.maximumSpeedScale,
      ),
    ),
    velocityGain: boundedNumber(
      value,
      "velocityGain",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.velocityGain,
    ),
    idleDecaySeconds: boundedNumber(
      value,
      "idleDecaySeconds",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds.maximum,
      DEFAULT_READER_GESTURE_PAGE_TURN_TUNING.idleDecaySeconds,
    ),
  };
}

function normalizeDirectionalGesturePageTurnTuning(
  value: object | undefined,
): ReaderDirectionalPageTurnTuning<
  ReaderGesturePageTurnTuning,
  ReaderReverseGesturePageTurnTuning
> {
  if (!value) {
    return DEFAULT_READER_PAGE_TURN_TUNING.gesture;
  }
  const forwardSource = nestedObject(value, "forward") ?? value;
  const nestedBackwardSource = nestedObject(value, "backward");
  const backwardSource = nestedBackwardSource ?? value;
  return {
    forward: normalizeGesturePageTurnTuning(forwardSource),
    backward: normalizeReverseGesturePageTurnTuning(
      backwardSource,
      nestedBackwardSource !== undefined,
    ),
  };
}

function normalizeReverseGesturePageTurnTuning(
  value: object,
  includesReverseSpeedControls: boolean,
): ReaderReverseGesturePageTurnTuning {
  const speedValue = includesReverseSpeedControls ? value : {};
  const revealStart = boundedNumber(
    value,
    "incomingRevealStartProgress",
    0,
    0.85,
    DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingRevealStartProgress,
  );
  const minimumSpeedScale = boundedNumber(
    speedValue,
    "minimumSpeedScale",
    FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale.minimum,
    FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale.maximum,
    DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.minimumSpeedScale,
  );
  return {
    releaseX: boundedNumber(
      value,
      "releaseX",
      0.25,
      0.95,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.releaseX,
    ),
    curvatureRelaxation: boundedNumber(
      value,
      "curvatureRelaxation",
      2,
      20,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.curvatureRelaxation,
    ),
    incomingLandingStartProgress: boundedNumber(
      value,
      "incomingLandingStartProgress",
      0.05,
      0.85,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingLandingStartProgress,
    ),
    incomingRevealStartProgress: revealStart,
    incomingRevealEndProgress: boundedNumber(
      value,
      "incomingRevealEndProgress",
      revealStart + 0.02,
      0.95,
      Math.max(
        revealStart + 0.02,
        DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingRevealEndProgress,
      ),
    ),
    incomingDragProgressScale: boundedNumber(
      value,
      "incomingDragProgressScale",
      0.25,
      3,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingDragProgressScale,
    ),
    incomingDragProgressExponent: boundedNumber(
      value,
      "incomingDragProgressExponent",
      0.35,
      3,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingDragProgressExponent,
    ),
    incomingSettleDurationSeconds: boundedNumber(
      value,
      "incomingSettleDurationSeconds",
      0.15,
      1.5,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingSettleDurationSeconds,
    ),
    incomingSettleEasingPower: boundedNumber(
      value,
      "incomingSettleEasingPower",
      0.75,
      6,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingSettleEasingPower,
    ),
    incomingRevertDurationSeconds: boundedNumber(
      value,
      "incomingRevertDurationSeconds",
      0.1,
      1.5,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.incomingRevertDurationSeconds,
    ),
    pageWeight: boundedNumber(
      value,
      "pageWeight",
      0.25,
      3,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.pageWeight,
    ),
    commitThreshold: boundedNumber(
      value,
      "commitThreshold",
      0.15,
      1.5,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.commitThreshold,
    ),
    minimumSpeedScale,
    maximumSpeedScale: boundedNumber(
      speedValue,
      "maximumSpeedScale",
      minimumSpeedScale,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.maximumSpeedScale.maximum,
      Math.max(
        minimumSpeedScale,
        DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.maximumSpeedScale,
      ),
    ),
    velocityGain: boundedNumber(
      speedValue,
      "velocityGain",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.maximum,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.velocityGain,
    ),
    idleDecaySeconds: boundedNumber(
      speedValue,
      "idleDecaySeconds",
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds.minimum,
      FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds.maximum,
      DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING.idleDecaySeconds,
    ),
  };
}

function nestedObject(value: object, key: string): object | undefined {
  const candidate = (value as Record<string, unknown>)[key];
  return candidate !== null && typeof candidate === "object"
    ? candidate
    : undefined;
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

function steppedNumber(
  value: object,
  key: string,
  minimum: number,
  maximum: number,
  step: number,
  fallback: number,
): number {
  const candidate =
    key in value ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return fallback;
  }
  const clamped = Math.min(maximum, Math.max(minimum, candidate));
  const stepCount = Math.round((clamped - minimum) / step);
  return Number((minimum + stepCount * step).toFixed(3));
}
