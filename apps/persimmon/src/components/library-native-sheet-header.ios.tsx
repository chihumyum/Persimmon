import { Button, Host, HStack, Spacer, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";

import type { LibraryNativeSheetHeaderProps } from "./library-native-sheet-header.types";
import { iosNativeRoundControlModifiers } from "./ios-native-round-control";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeSheetHeader({
  backAccessibilityLabel,
  closeAccessibilityLabel,
  theme,
  title,
  onBack,
  onClose,
}: LibraryNativeSheetHeaderProps) {
  return (
    <Host
      colorScheme={theme.colorScheme}
      ignoreSafeArea="all"
      seedColor={theme.accent}
      style={styles.host}
    >
      <HStack
        alignment="center"
        modifiers={[
          padding({ horizontal: uiSize.optionHorizontalInset }),
          frame({ maxWidth: 10_000, height: uiSize.sheetHeader }),
        ]}
      >
        {onBack ? (
          <Button
            label={backAccessibilityLabel ?? title}
            modifiers={[
              ...iosNativeRoundControlModifiers({
                dimension: uiSize.control,
                iconSize: uiSize.controlIcon,
                surface: "glass",
              }),
              labelStyle("iconOnly"),
              tint(theme.controlText),
              accessibilityLabel(backAccessibilityLabel ?? title),
            ]}
            systemImage="chevron.left"
            onPress={onBack}
          />
        ) : (
          <Spacer minLength={uiSize.control} />
        )}
        <Spacer minLength={10} />
        <Text
          modifiers={[
            font({
              size: uiTypography.sheetHeader.fontSize,
              weight: "semibold",
            }),
            foregroundStyle(theme.text),
            frame({ maxWidth: 10_000, alignment: "center" }),
          ]}
        >
          {title}
        </Text>
        <Spacer minLength={10} />
        <Button
          label={closeAccessibilityLabel}
          modifiers={[
            ...iosNativeRoundControlModifiers({
              dimension: uiSize.control,
              iconSize: uiSize.controlIcon,
              surface: "glass",
            }),
            labelStyle("iconOnly"),
            tint(theme.controlText),
            accessibilityLabel(closeAccessibilityLabel),
          ]}
          systemImage="xmark"
          onPress={onClose}
        />
      </HStack>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    height: uiSize.sheetHeader,
    width: "100%",
  },
});
