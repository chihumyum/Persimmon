import type { ReaderTheme } from "@persimmon/reader-skia";

import type { BookMenuAction } from "../../modules/persimmon-selection-menu";

export interface LibraryBookMenuButtonProps {
  readonly accessibilityLabel: string;
  readonly canDelete: boolean;
  readonly deleteLabel: string;
  readonly detailsLabel: string;
  readonly syncLabel: string;
  readonly theme: ReaderTheme;
  readonly onAction: (action: BookMenuAction) => void;
  readonly onPress: () => void;
}
