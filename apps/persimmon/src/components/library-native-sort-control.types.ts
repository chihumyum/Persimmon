import type { ReaderTheme } from "@persimmon/reader-skia";
import type { LibrarySort } from "../library/library-view";

export interface LibraryNativeSortOption {
  readonly label: string;
  readonly value: LibrarySort;
}

export interface LibraryNativeSortControlProps {
  readonly accessibilityLabel: string;
  readonly options: readonly LibraryNativeSortOption[];
  readonly theme: ReaderTheme;
  readonly value: LibrarySort;
  readonly onChange: (value: LibrarySort) => void;
}
