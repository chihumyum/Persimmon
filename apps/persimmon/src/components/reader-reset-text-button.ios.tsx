import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import type { ReaderResetTextButtonProps } from "./reader-reset-text-button.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function ReaderResetTextButton({
  accessibilityLabel,
  label,
  style,
  theme,
  onPress,
}: ReaderResetTextButtonProps) {
  return (
    <View style={[styles.frame, style]}>
      <Host
        colorScheme={theme.colorScheme}
        ignoreSafeArea="all"
        matchContents
        seedColor={theme.accent}
      >
        <Button
          modifiers={[
            buttonStyle("plain"),
            accessibilityLabelModifier(accessibilityLabel),
          ]}
          onPress={onPress}
        >
          <Text
            modifiers={[
              font({
                size: uiTypography.optionAction.fontSize,
                weight: "medium",
              }),
              foregroundStyle(theme.accentStrong),
              frame({ minHeight: uiSize.minimumHitTarget }),
              padding({ horizontal: 16 }),
            ]}
          >
            {label}
          </Text>
        </Button>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export type { ReaderResetTextButtonProps } from "./reader-reset-text-button.types";
