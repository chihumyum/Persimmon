import type { ReaderTheme } from "@persimmon/reader-skia";
import type { StyleProp, ViewStyle } from "react-native";

export type AppRoundButtonIcon =
  | "add"
  | "back"
  | "check"
  | "close"
  | "cloud"
  | "more"
  | "reset"
  | "search"
  | "settings"
  | "sort"
  | "sync"
  | "toc"
  | "tuning"
  | "typography";

export interface AppRoundButtonProps {
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  readonly icon: AppRoundButtonIcon;
  readonly loading?: boolean;
  readonly size?: "compact" | "control";
  readonly style?: StyleProp<ViewStyle>;
  readonly surface?: "glass" | "plain";
  readonly theme: ReaderTheme;
  readonly tintColor?: string;
  readonly onPress: () => void;
}
