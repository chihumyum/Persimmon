import { normalizeReaderFontSettings } from "@persimmon/font-core";
import {
  DEFAULT_READER_APPEARANCE,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
  type ReaderAppearanceSettings,
  type ReaderColorMode,
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
    // Product tuning replaces all values saved by the retired debug panel.
    pageTurnTuning: DEFAULT_READER_PAGE_TURN_TUNING,
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
