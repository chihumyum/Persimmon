import { StyleSheet, Text as NativeText, type TextProps } from "react-native";

import { READER_UI_FONT_FAMILY } from "../reader/reader-ui-typography";

export function UiText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[styles.text, style]} />;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: READER_UI_FONT_FAMILY,
  },
});
