import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { uiShadow } from "./ui-shadow";
import { uiRadius, uiSpace } from "./ui-tokens";

export interface UiModalSurfaceProps {
  readonly children: ReactNode;
  readonly theme: ReaderTheme;
  readonly maxHeight?: DimensionValue;
  readonly maxWidth?: number;
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function UiModalSurface({
  children,
  maxHeight = "86%",
  maxWidth = 500,
  padding = uiSpace.xl,
  style,
  theme,
}: UiModalSurfaceProps) {
  return (
    <View
      style={[
        styles.surface,
        uiShadow(theme, "modal"),
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
          maxHeight,
          maxWidth,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: uiRadius.modal,
    borderWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
});
