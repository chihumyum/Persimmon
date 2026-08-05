import {
  Button,
  Host,
  HStack,
  Image,
  Menu,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet } from "react-native";

import { uiSize, uiSpace, uiTypography } from "./ui-tokens";

interface ReaderSettingsMenuOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

interface ReaderSettingsMenuRowProps<Value extends string> {
  readonly accessibilityLabel: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly options: readonly ReaderSettingsMenuOption<Value>[];
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

export function ReaderSettingsMenuRow<Value extends string>({
  accessibilityLabel: rowAccessibilityLabel,
  description,
  disabled = false,
  options,
  theme,
  title,
  value,
  onChange,
}: ReaderSettingsMenuRowProps<Value>) {
  const selected = options.find((option) => option.value === value);
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  return (
    <Host
      colorScheme={theme.colorScheme}
      ignoreSafeArea="all"
      seedColor={theme.accent}
      style={[styles.host, { height: rowHeight }]}
    >
      <HStack
        alignment="center"
        modifiers={[
          padding({ horizontal: uiSize.optionHorizontalInset }),
          frame({
            maxWidth: 10_000,
            minHeight: rowHeight,
            alignment: "leading",
          }),
        ]}
      >
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({
                size: uiTypography.optionLabel.fontSize,
                weight: "medium",
              }),
              foregroundStyle(
                disabled ? theme.secondaryText : theme.controlText,
              ),
              lineLimit(1),
            ]}
          >
            {title}
          </Text>
          {description ? (
            <Text
              modifiers={[
                font({ size: uiTypography.optionDescription.fontSize }),
                foregroundStyle(theme.secondaryText),
                lineLimit(2),
              ]}
            >
              {description}
            </Text>
          ) : null}
        </VStack>
        <Spacer minLength={uiSpace.md} />
        <Menu
          label={
            <HStack alignment="center" spacing={4}>
              <Text
                modifiers={[
                  font({ size: uiTypography.optionValue.fontSize }),
                  foregroundStyle(theme.secondaryText),
                  lineLimit(1),
                ]}
              >
                {selected?.label ?? value}
              </Text>
              <Image
                color={theme.secondaryText}
                size={12}
                systemName="chevron.down"
              />
            </HStack>
          }
          modifiers={[
            accessibilityLabel(rowAccessibilityLabel),
            disabledModifier(disabled),
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
      </HStack>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});
