import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ReactNode } from "react";

export interface LibraryNativeSearchResultsSurfaceProps {
  readonly children: ReactNode;
  readonly theme: ReaderTheme;
}
