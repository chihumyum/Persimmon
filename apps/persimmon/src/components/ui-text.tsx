import { StyleSheet, Text as NativeText, type TextProps } from "react-native";

import { READER_UI_FONT_FAMILY } from "../reader/reader-ui-typography";
import { uiTypography, type UiTextVariant } from "./ui-tokens";

export interface UiTextProps extends TextProps {
  readonly variant?: UiTextVariant;
}

export function UiText({ style, variant, ...props }: UiTextProps) {
  return (
    <NativeText
      {...props}
      style={[styles.text, variant ? uiTypography[variant] : undefined, style]}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: READER_UI_FONT_FAMILY,
  },
});
