import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import type { AppRoundButtonProps } from "./app-round-button.types";
import { UiIcon } from "./ui-icon";
import { uiSize } from "./ui-tokens";

export function AppRoundButton({
  accessibilityLabel,
  disabled = false,
  icon,
  loading = false,
  size = "control",
  style,
  surface = "glass",
  theme,
  tintColor = theme.controlText,
  onPress,
}: AppRoundButtonProps) {
  const dimension = size === "compact" ? uiSize.compactControl : uiSize.control;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor:
            surface === "plain" ? "transparent" : theme.panelRaised,
          height: dimension,
          opacity: pressed ? 0.82 : 1,
          width: dimension,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tintColor} size="small" />
      ) : (
        <UiIcon
          color={tintColor}
          name={icon}
          size={size === "compact" ? 20 : uiSize.controlIcon}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: uiSize.control / 2,
    justifyContent: "center",
  },
});

export type { AppRoundButtonProps } from "./app-round-button.types";
