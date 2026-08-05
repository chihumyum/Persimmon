import { StyleSheet } from "react-native";

import { AppRoundButton } from "./app-round-button";
import type { ReaderChromeButtonProps } from "./reader-chrome-button.types";
import { UiButton } from "./ui-button";
import { uiSize } from "./ui-tokens";

export function ReaderChromeButton({
  accessibilityLabel,
  disabled = false,
  icon,
  iconOnly = true,
  label,
  style,
  theme,
  tintColor,
  onPress,
}: ReaderChromeButtonProps) {
  if (iconOnly) {
    return (
      <AppRoundButton
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        icon={icon}
        onPress={onPress}
        style={style}
        theme={theme}
        tintColor={tintColor}
      />
    );
  }

  return (
    <UiButton
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      label={label}
      leadingIcon={icon}
      onPress={onPress}
      style={[styles.labelButton, style]}
      textStyle={tintColor ? { color: tintColor } : undefined}
      theme={theme}
      variant="chrome"
    />
  );
}

const styles = StyleSheet.create({
  labelButton: {
    minHeight: uiSize.control,
  },
});

export type { ReaderChromeButtonProps } from "./reader-chrome-button.types";
