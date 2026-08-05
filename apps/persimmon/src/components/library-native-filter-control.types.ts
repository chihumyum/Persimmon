import type { ReaderTheme } from "@persimmon/reader-skia";
import type { LibraryFilter } from "../library/library-view";

export interface LibraryNativeFilterOption {
  readonly label: string;
  readonly value: LibraryFilter;
}

export interface LibraryNativeFilterControlProps {
  readonly accessibilityLabel: string;
  readonly options: readonly LibraryNativeFilterOption[];
  readonly theme: ReaderTheme;
  readonly value: LibraryFilter;
  readonly onChange: (value: LibraryFilter) => void;
}
