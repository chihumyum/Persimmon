import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ReactNode } from "react";

export interface ReaderBottomSheetProps {
  /**
   * Whether the native sheet surface may move in response to a pan gesture.
   * Programmatic snap changes remain available when this is false.
   */
  readonly allowsUserResizing?: boolean;
  readonly androidHeightRatio?: number;
  readonly children: ReactNode;
  readonly dismissible?: boolean;
  readonly expanded?: boolean;
  readonly snapIndex?: number;
  readonly snapPoints: (number | string)[];
  readonly testID?: string;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onBackPress?: () => void;
  readonly onDismiss: () => void;
}
