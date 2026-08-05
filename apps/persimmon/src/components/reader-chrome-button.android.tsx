import { requireNativeView } from "expo";
import type { ComponentType } from "react";
import {
  processColor,
  StyleSheet,
  type NativeSyntheticEvent,
  type ViewProps,
  View,
} from "react-native";

import { AppRoundButton } from "./app-round-button";
import type { ReaderChromeButtonProps } from "./reader-chrome-button.types";
import { UiButton } from "./ui-button";
import { uiSize } from "./ui-tokens";

interface NativeReaderChromeTouchProps extends ViewProps {
  readonly pressEnabled: boolean;
  readonly rippleColor: ReturnType<typeof processColor>;
  readonly onPress?: (
    event: NativeSyntheticEvent<Record<string, never>>,
  ) => void;
}

const NativeReaderChromeTouchView: ComponentType<NativeReaderChromeTouchProps> =
  requireNativeView<NativeReaderChromeTouchProps>(
    "PersimmonSelectionMenu",
    "PersimmonReaderChromeTouchView",
  );

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
      <View style={[styles.nativeTouchFrame, style]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <AppRoundButton
            accessibilityLabel={accessibilityLabel}
            disabled={disabled}
            icon={icon}
            onPress={onPress}
            theme={theme}
            tintColor={tintColor}
          />
        </View>
        <NativeReaderChromeTouchView
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          pressEnabled={!disabled}
          rippleColor={processColor(theme.panelMuted)}
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!disabled) {
              onPress();
            }
          }}
        />
      </View>
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
  nativeTouchFrame: {
    height: uiSize.control,
    width: uiSize.control,
  },
});

export type { ReaderChromeButtonProps } from "./reader-chrome-button.types";
