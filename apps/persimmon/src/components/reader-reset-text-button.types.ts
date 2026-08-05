import type { ReaderTheme } from "@persimmon/reader-skia";
import type { StyleProp, ViewStyle } from "react-native";

export interface ReaderResetTextButtonProps {
  readonly accessibilityLabel: string;
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly theme: ReaderTheme;
  readonly onPress: () => void;
}
