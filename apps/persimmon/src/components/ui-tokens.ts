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
  compactControl: 36,
  compactControlHitSlop: 4,
  readerChrome: 34,
  readerChromeHitSlop: 5,
  readerChromePanelGap: 12,
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
