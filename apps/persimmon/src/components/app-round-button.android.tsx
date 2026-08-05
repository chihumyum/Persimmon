import {
  CircularProgressIndicator,
  FilledTonalIconButton,
  Host,
  Icon,
  IconButton,
} from "@expo/ui/jetpack-compose";
import { size as nativeSize } from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet, View } from "react-native";

import addIcon from "../assets/icons/add.xml";
import backIcon from "../assets/icons/back.xml";
import checkIcon from "../assets/icons/check.xml";
import closeIcon from "../assets/icons/close.xml";
import cloudIcon from "../assets/icons/cloud.xml";
import moreIcon from "../assets/icons/more.xml";
import resetIcon from "../assets/icons/reset.xml";
import searchIcon from "../assets/icons/search.xml";
import settingsIcon from "../assets/icons/settings.xml";
import sortIcon from "../assets/icons/sort.xml";
import syncIcon from "../assets/icons/sync.xml";
import tocIcon from "../assets/icons/toc.xml";
import tuningIcon from "../assets/icons/tuning.xml";
import typographyIcon from "../assets/icons/typography.xml";
import type {
  AppRoundButtonIcon,
  AppRoundButtonProps,
} from "./app-round-button.types";
import { uiSize } from "./ui-tokens";

const ICONS: Record<AppRoundButtonIcon, typeof closeIcon> = {
  add: addIcon,
  back: backIcon,
  check: checkIcon,
  close: closeIcon,
  cloud: cloudIcon,
  more: moreIcon,
  reset: resetIcon,
  search: searchIcon,
  settings: settingsIcon,
  sort: sortIcon,
  sync: syncIcon,
  toc: tocIcon,
  tuning: tuningIcon,
  typography: typographyIcon,
};

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
  const NativeButton = surface === "plain" ? IconButton : FilledTonalIconButton;

  return (
    <View
      collapsable={false}
      pointerEvents="auto"
      style={[styles.frame, { height: dimension, width: dimension }, style]}
    >
      <Host
        colorScheme={theme.colorScheme}
        pointerEvents="auto"
        seedColor={theme.accent}
        style={{ height: dimension, width: dimension }}
      >
        {loading ? (
          <CircularProgressIndicator
            color={tintColor}
            modifiers={[nativeSize(dimension, dimension)]}
          />
        ) : (
          <NativeButton
            colors={{
              containerColor:
                surface === "plain" ? "transparent" : theme.panelRaised,
              contentColor: tintColor,
              disabledContainerColor:
                surface === "plain" ? "transparent" : theme.panelMuted,
              disabledContentColor: theme.secondaryText,
            }}
            enabled={!disabled}
            modifiers={[nativeSize(dimension, dimension)]}
            onClick={onPress}
          >
            <Icon
              contentDescription={accessibilityLabel}
              size={size === "compact" ? 20 : uiSize.controlIcon}
              source={ICONS[icon]}
              tint={tintColor}
            />
          </NativeButton>
        )}
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
