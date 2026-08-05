import type { ReaderTheme } from "@persimmon/reader-skia";
import type { StyleProp, ViewStyle } from "react-native";

export type ReaderChromeIcon =
  | "back"
  | "check"
  | "close"
  | "reset"
  | "toc"
  | "tuning"
  | "typography";

export interface ReaderChromeButtonProps {
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  readonly icon: ReaderChromeIcon;
  readonly iconOnly?: boolean;
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly theme: ReaderTheme;
  readonly tintColor?: string;
  readonly onPress: () => void;
}
