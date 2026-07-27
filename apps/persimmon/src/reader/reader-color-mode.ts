import type { ResolvedReaderColorScheme } from "@persimmon/reader-skia";

import type { ReaderColorMode } from "../library/types";

export function resolveReaderColorScheme(
  colorMode: ReaderColorMode,
  systemColorScheme: ResolvedReaderColorScheme,
): ResolvedReaderColorScheme {
  return colorMode === "system" ? systemColorScheme : colorMode;
}
