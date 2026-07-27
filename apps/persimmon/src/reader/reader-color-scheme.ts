import { useEffect, useState } from "react";
import { Appearance, AppState, Platform, useColorScheme } from "react-native";

import type { ResolvedReaderColorScheme } from "@persimmon/reader-skia";

function normalizeColorScheme(value: unknown): ResolvedReaderColorScheme {
  return value === "dark" ? "dark" : "light";
}

function currentSystemColorScheme(): ResolvedReaderColorScheme {
  if (Platform.OS === "web" && typeof globalThis.matchMedia === "function") {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return normalizeColorScheme(Appearance.getColorScheme());
}

/**
 * `useColorScheme` is the normal fast path. The explicit Appearance,
 * matchMedia, and foreground listeners cover devices/browsers that do not
 * deliver a hook update while the app is inactive.
 */
export function useSystemReaderColorScheme(): ResolvedReaderColorScheme {
  const hookColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState(currentSystemColorScheme);

  useEffect(() => {
    setColorScheme(
      Platform.OS === "web" ||
        (hookColorScheme !== "light" && hookColorScheme !== "dark")
        ? currentSystemColorScheme()
        : hookColorScheme,
    );
  }, [hookColorScheme]);

  useEffect(() => {
    const refresh = () => setColorScheme(currentSystemColorScheme());
    const appearanceSubscription = Appearance.addChangeListener(refresh);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          refresh();
        }
      },
    );
    const media =
      Platform.OS === "web" && typeof globalThis.matchMedia === "function"
        ? globalThis.matchMedia("(prefers-color-scheme: dark)")
        : undefined;
    media?.addEventListener?.("change", refresh);
    refresh();
    return () => {
      appearanceSubscription.remove();
      appStateSubscription.remove();
      media?.removeEventListener?.("change", refresh);
    };
  }, []);

  return colorScheme;
}
