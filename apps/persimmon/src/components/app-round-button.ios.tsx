import { Button, Host, ProgressView } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  disabled as disabledModifier,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import type {
  AppRoundButtonIcon,
  AppRoundButtonProps,
} from "./app-round-button.types";
import { iosNativeRoundControlModifiers } from "./ios-native-round-control";
import { uiSize } from "./ui-tokens";

const SYSTEM_IMAGES = {
  add: "plus",
  back: "chevron.left",
  check: "checkmark",
  close: "xmark",
  cloud: "icloud",
  more: "ellipsis",
  reset: "arrow.counterclockwise",
  search: "magnifyingglass",
  settings: "gearshape",
  sort: "arrow.up.arrow.down",
  sync: "arrow.clockwise",
  toc: "list.bullet",
  tuning: "slider.horizontal.3",
  typography: "textformat.size",
} as const satisfies Record<
  AppRoundButtonIcon,
  NonNullable<ComponentProps<typeof Button>["systemImage"]>
>;

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
    <View
      collapsable={false}
      pointerEvents="auto"
      style={[styles.frame, { height: dimension, width: dimension }, style]}
    >
      <Host
        colorScheme={theme.colorScheme}
        ignoreSafeArea="all"
        matchContents
        seedColor={theme.accent}
      >
        <Button
          label={loading ? undefined : accessibilityLabel}
          modifiers={[
            ...iosNativeRoundControlModifiers({
              dimension,
              iconSize: size === "compact" ? 20 : uiSize.controlIcon,
              surface,
            }),
            labelStyle("iconOnly"),
            tint(tintColor),
            disabledModifier(disabled || loading),
            accessibilityLabelModifier(accessibilityLabel),
          ]}
          systemImage={loading ? undefined : SYSTEM_IMAGES[icon]}
          onPress={onPress}
        >
          {loading ? <ProgressView /> : undefined}
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

export type { AppRoundButtonProps } from "./app-round-button.types";
