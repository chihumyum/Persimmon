import type { ReaderTheme } from "@persimmon/reader-skia";
import type { StyleProp, ViewStyle } from "react-native";

export type LibraryNativeToolbarIcon =
  | "add"
  | "back"
  | "check"
  | "close"
  | "cloud"
  | "more"
  | "search"
  | "settings"
  | "sort"
  | "sync";

export interface LibraryNativeToolbarButtonProps {
  readonly accessibilityLabel: string;
  readonly compact?: boolean;
  readonly disabled?: boolean;
  readonly icon: LibraryNativeToolbarIcon;
  readonly loading?: boolean;
  readonly plain?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly theme: ReaderTheme;
  readonly tintColor?: string;
  readonly onPress: () => void;
}
