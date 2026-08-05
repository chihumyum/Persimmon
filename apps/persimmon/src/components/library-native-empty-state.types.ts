import type { ReaderTheme } from "@persimmon/reader-skia";
import type { StyleProp, ViewStyle } from "react-native";

export interface LibraryNativeEmptyStateProps {
  readonly body: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly theme: ReaderTheme;
  readonly title: string;
}
