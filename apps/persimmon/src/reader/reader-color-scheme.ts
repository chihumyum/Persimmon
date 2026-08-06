import { useEffect, useState } from "react";
import { Appearance, AppState, useColorScheme } from "react-native";

import type { ResolvedReaderColorScheme } from "@persimmon/reader-skia";

function normalizeColorScheme(value: unknown): ResolvedReaderColorScheme {
  return value === "dark" ? "dark" : "light";
}

function currentSystemColorScheme(): ResolvedReaderColorScheme {
  return normalizeColorScheme(Appearance.getColorScheme());
}

/**
 * `useColorScheme` is the normal fast path. The explicit Appearance,
 * and foreground listeners cover devices that do not deliver a hook update
 * while the app is inactive.
 */
export function useSystemReaderColorScheme(): ResolvedReaderColorScheme {
  const hookColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState(currentSystemColorScheme);

  useEffect(() => {
    setColorScheme(
      hookColorScheme !== "light" && hookColorScheme !== "dark"
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
    refresh();
    return () => {
      appearanceSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return colorScheme;
}
