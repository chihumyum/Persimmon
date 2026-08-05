import type { ReaderTheme } from "@persimmon/reader-skia";

export type LibraryNativeSyncNoticeKind =
  | "attention"
  | "cloud"
  | "success"
  | "syncing";

export interface LibraryNativeSyncNoticeProps {
  readonly closeAccessibilityLabel?: string;
  readonly description: string;
  readonly floating?: boolean;
  readonly kind: LibraryNativeSyncNoticeKind;
  readonly openAccessibilityLabel: string;
  readonly progress?: number;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly onClose?: () => void;
  readonly onOpen: () => void;
}
