import {
  resolveReaderTheme,
  type ReaderTheme,
  type ResolvedReaderColorScheme,
} from "@persimmon/reader-skia/theme";
import type { ColorSchemeName } from "react-native";

import type { ReaderAppearanceSettings } from "./library/types";

export function resolveAppColorScheme(
  colorMode: ReaderAppearanceSettings["colorMode"],
  systemColorScheme: ColorSchemeName,
): ResolvedReaderColorScheme {
  if (colorMode !== "system") {
    return colorMode;
  }
  return systemColorScheme === "dark" ? "dark" : "light";
}

export function resolveAppTheme(
  appearance: ReaderAppearanceSettings,
  systemColorScheme: ColorSchemeName,
): ReaderTheme {
  return resolveReaderTheme(
    appearance.theme,
    resolveAppColorScheme(appearance.colorMode, systemColorScheme),
  );
}
