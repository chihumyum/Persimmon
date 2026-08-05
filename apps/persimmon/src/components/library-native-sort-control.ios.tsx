import { Button, Host, HStack, Image, Menu, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";

import type { LibraryNativeSortControlProps } from "./library-native-sort-control.types";
import { iosNativeRoundControlModifiers } from "./ios-native-round-control";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeSortControl({
  accessibilityLabel: controlAccessibilityLabel,
  iconOnly,
  options,
  theme,
  value,
  onChange,
}: LibraryNativeSortControlProps) {
  const selected = options.find((option) => option.value === value);
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
          iconOnly ? (
            <Image
              color={theme.controlText}
              size={uiSize.controlIcon}
              systemName="arrow.up.arrow.down"
            />
          ) : (
            <HStack alignment="center" spacing={7}>
              <Image
                color={theme.controlText}
                size={17}
                systemName="arrow.up.arrow.down"
              />
              <Text
                modifiers={[
                  font({
                    size: uiTypography.optionValue.fontSize,
                    weight: "medium",
                  }),
                  foregroundStyle(theme.controlText),
                ]}
              >
                {selected?.label ?? ""}
              </Text>
              <Image
                color={theme.secondaryText}
                size={11}
                systemName="chevron.down"
              />
            </HStack>
          )
        }
        modifiers={[
          ...(iconOnly
            ? iosNativeRoundControlModifiers({
                dimension: uiSize.control,
                iconSize: uiSize.controlIcon,
                surface: "glass",
              })
            : [
                frame({ minHeight: uiSize.control }),
                buttonStyle("plain"),
                glassEffect({
                  glass: { interactive: true, variant: "regular" },
                  shape: "capsule",
                }),
              ]),
          labelStyle(iconOnly ? "iconOnly" : "titleAndIcon"),
          tint(theme.controlText),
          padding({ horizontal: iconOnly ? 0 : 2 }),
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
