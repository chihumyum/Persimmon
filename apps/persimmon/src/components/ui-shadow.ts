import type { ReaderTheme } from "@persimmon/reader-skia";
import { Platform, type ViewStyle } from "react-native";

export type UiElevation = "chrome" | "floating" | "modal";
export type UiBackdropStrength = "soft" | "standard";

const WEB_SHADOW: Readonly<Record<UiElevation, string>> = {
  chrome: "0 2px 9px",
  floating: "0 8px 28px",
  modal: "0 22px 70px",
};

const WEB_ALPHA: Readonly<Record<UiElevation, string>> = {
  chrome: "1a",
  floating: "2e",
  modal: "47",
};

export function uiBackdropColor(
  theme: ReaderTheme,
  strength: UiBackdropStrength = "standard",
): string {
  if (theme.colorScheme === "dark") {
    return strength === "soft" ? "rgba(0, 0, 0, 0.38)" : "rgba(0, 0, 0, 0.52)";
  }
  return strength === "soft"
    ? "rgba(38, 29, 22, 0.22)"
    : "rgba(38, 29, 22, 0.28)";
}

export function uiShadow(
  theme: ReaderTheme,
  elevation: UiElevation,
): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: `${WEB_SHADOW[elevation]} ${theme.shadow}${WEB_ALPHA[elevation]}`,
    } as ViewStyle;
  }

  switch (elevation) {
    case "chrome":
      return {
        elevation: 2,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      };
    case "floating":
      return {
        elevation: 9,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      };
    case "modal":
      return {
        elevation: 14,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.26,
        shadowRadius: 32,
      };
  }
}
