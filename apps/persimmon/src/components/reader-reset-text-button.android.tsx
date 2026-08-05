import { Host, Text, TextButton } from "@expo/ui/jetpack-compose";
import { height } from "@expo/ui/jetpack-compose/modifiers";
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
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[styles.frame, style]}
    >
      <Host
        colorScheme={theme.colorScheme}
        matchContents
        seedColor={theme.accent}
      >
        <TextButton
          colors={{
            containerColor: "transparent",
            contentColor: theme.accentStrong,
          }}
          modifiers={[height(uiSize.minimumHitTarget)]}
          onClick={onPress}
        >
          <Text color={theme.accentStrong} style={uiTypography.optionAction}>
            {label}
          </Text>
        </TextButton>
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
