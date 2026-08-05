import type { ReaderTheme } from "@persimmon/reader-skia";

export interface LibraryNativeSheetHeaderProps {
  readonly backAccessibilityLabel?: string;
  readonly closeAccessibilityLabel: string;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly onBack?: () => void;
  readonly onClose: () => void;
}
