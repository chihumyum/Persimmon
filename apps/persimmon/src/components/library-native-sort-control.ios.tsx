import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";

import type { LibraryNativeSortControlProps } from "./library-native-sort-control.types";
import { iosNativeRoundControlModifiers } from "./ios-native-round-control";
import { uiSize } from "./ui-tokens";

export function LibraryNativeSortControl({
  accessibilityLabel: controlAccessibilityLabel,
  options,
  theme,
  value,
  onChange,
}: LibraryNativeSortControlProps) {
  return (
    <Host
      colorScheme={theme.colorScheme}
      ignoreSafeArea="all"
      matchContents
      seedColor={theme.accent}
      style={styles.host}
    >
      <Menu
        label={
          <Image
            color={theme.controlText}
            size={uiSize.controlIcon}
            systemName="arrow.up.arrow.down"
          />
        }
        modifiers={[
          ...iosNativeRoundControlModifiers({
            dimension: uiSize.control,
            iconSize: uiSize.controlIcon,
            surface: "glass",
          }),
          labelStyle("iconOnly"),
          tint(theme.controlText),
          accessibilityLabel(controlAccessibilityLabel),
        ]}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            systemImage={option.value === value ? "checkmark" : undefined}
            onPress={() => onChange(option.value)}
          />
        ))}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { minHeight: uiSize.control },
});
