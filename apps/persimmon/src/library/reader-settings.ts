import { normalizeReaderFontSettings } from "@persimmon/font-core";

import {
  DEFAULT_READER_APPEARANCE,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
  type ReaderAppearanceSettings,
  type ReaderColorMode,
  type ReaderGesturePageTurnTuning,
  type ReaderPageTurnTuning,
  type ReaderProgressDisplay,
  type ReaderSettings,
  type ReaderThemeName,
} from "./types";

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
      16,
      32,
      1,
      DEFAULT_READER_APPEARANCE.fontSize,
    ),
    lineHeight: steppedNumber(
      value,
      "lineHeight",
      1.25,
      2.1,
      0.05,
      DEFAULT_READER_APPEARANCE.lineHeight,
    ),
    paragraphSpacing: steppedNumber(
      value,
      "paragraphSpacing",
      0,
      2,
      0.1,
      DEFAULT_READER_APPEARANCE.paragraphSpacing,
    ),
    horizontalMargin: steppedNumber(
      value,
      "horizontalMargin",
      16,
      72,
      4,
      DEFAULT_READER_APPEARANCE.horizontalMargin,
    ),
    progressDisplay: readerProgressDisplay(value),
  };
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
  const gestureSource =
    "gesture" in value &&
    typeof value.gesture === "object" &&
    value.gesture !== null
      ? value.gesture
      : undefined;
  return {
    gesture: normalizeGesturePageTurnTuning(gestureSource),
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
