import type { ReaderTheme } from "@persimmon/reader-skia";

export interface LibraryNativeSearchFieldProps {
  readonly autoFocus?: boolean;
  readonly clearAccessibilityLabel: string;
  readonly placeholder: string;
  readonly query: string;
  readonly theme: ReaderTheme;
  readonly onQueryChange: (query: string) => void;
}
