import type { TextStyle } from "react-native";

/**
 * Product-level layout tokens. ReaderTheme remains the source of truth for
 * semantic colors; these values keep application chrome and panels aligned.
 */
export const uiSpace = {
  hairline: 1,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const uiRadius = {
  cover: 4,
  small: 8,
  control: 11,
  card: 14,
  panel: 18,
  modal: 22,
  pill: 999,
} as const;

export const uiSize = {
  minimumHitTarget: 44,
  compactControl: 40,
  compactControlHitSlop: 2,
  /**
   * Canonical diameter for every circular app control. Segmented controls
   * deliberately use the same height so neighboring controls share one rail.
   */
  control: 50,
  controlIcon: 22,
  readerChrome: 50,
  readerChromeHitSlop: 0,
  readerChromePanelGap: 12,
  segmentedControl: 50,
  sheetHeader: 66,
  sheetHeaderInset: 8,
  optionRow: 60,
  optionRowWithDescription: 76,
  /**
   * SwiftUI Form/Section supplies the remaining native row chrome around
   * this content. These resolve visually to the same 60/76 pt row rails.
   */
  nativeGroupedRowContent: 44,
  nativeGroupedRowWithDescriptionContent: 58,
  optionHorizontalInset: 16,
  dividerHorizontalInset: 16,
} as const;

export const uiSheet = {
  readerSettingsAllowsUserResizing: true,
  readerSettingsRootHeightRatio: 0.58,
  readerSettingsFontHeightRatio: 0.76,
  readerSettingsTypographyHeightRatio: 0.4,
} as const;

export const uiMotion = {
  fast: 120,
  standard: 180,
  deliberate: 260,
} as const;

export const uiTypography = {
  display: {
    fontSize: 31,
    fontWeight: "700",
    letterSpacing: -0.75,
    lineHeight: 38,
  },
  modalTitle: {
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.45,
    lineHeight: 31,
  },
  panelTitle: {
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 24,
  },
  sheetHeader: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 25,
  },
  segmentLabel: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 23,
  },
  optionDescription: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 19,
  },
  optionValue: {
    fontSize: 17,
    fontWeight: "400",
    lineHeight: 23,
  },
  optionAction: {
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 23,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  bodyStrong: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  button: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
  },
  micro: {
    fontSize: 10,
    lineHeight: 14,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
    lineHeight: 12,
  },
} as const satisfies Record<string, TextStyle>;

export type UiTextVariant = keyof typeof uiTypography;
