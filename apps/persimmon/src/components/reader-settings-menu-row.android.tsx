import {
  DropdownMenu,
  DropdownMenuItem,
  Column,
  Host,
  Icon,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  height,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { useState } from "react";
import { StyleSheet } from "react-native";

import chevronDownIcon from "../assets/icons/chevron_down.xml";
import { uiSize, uiTypography } from "./ui-tokens";

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
  accessibilityLabel,
  description,
  disabled = false,
  options,
  theme,
  title,
  value,
  onChange,
}: ReaderSettingsMenuRowProps<Value>) {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  return (
    <Host
      colorScheme={theme.colorScheme}
      seedColor={theme.accent}
      style={[styles.host, { height: rowHeight }]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          height(rowHeight),
          ...(disabled ? [] : [clickable(() => setExpanded(true))]),
          padding(
            uiSize.optionHorizontalInset,
            0,
            uiSize.optionHorizontalInset,
            0,
          ),
        ]}
      >
        <Column modifiers={[weight(1)]} verticalArrangement="center">
          <Text
            color={disabled ? theme.secondaryText : theme.controlText}
            maxLines={1}
            style={uiTypography.optionLabel}
          >
            {title}
          </Text>
          {description ? (
            <Text
              color={theme.secondaryText}
              maxLines={2}
              style={uiTypography.optionDescription}
            >
              {description}
            </Text>
          ) : undefined}
        </Column>
        <DropdownMenu
          expanded={expanded}
          onDismissRequest={() => setExpanded(false)}
        >
          <DropdownMenu.Trigger>
            <Row
              horizontalArrangement={{ spacedBy: 4 }}
              verticalAlignment="center"
              modifiers={[padding(8, 8, 0, 8)]}
            >
              <Text
                color={theme.secondaryText}
                maxLines={1}
                style={uiTypography.optionValue}
              >
                {selected?.label ?? value}
              </Text>
              <Icon
                contentDescription={accessibilityLabel}
                size={18}
                source={chevronDownIcon}
                tint={theme.secondaryText}
              />
            </Row>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {options.map((option) => (
              <DropdownMenuItem
                elementColors={{
                  textColor: theme.controlText,
                  trailingIconColor: theme.accent,
                }}
                key={option.value}
                onClick={() => {
                  setExpanded(false);
                  onChange(option.value);
                }}
              >
                <DropdownMenuItem.Text>
                  <Text color={theme.controlText}>{option.label}</Text>
                </DropdownMenuItem.Text>
                {option.value === value ? (
                  <DropdownMenuItem.TrailingIcon>
                    <Text color={theme.accent}>✓</Text>
                  </DropdownMenuItem.TrailingIcon>
                ) : undefined}
              </DropdownMenuItem>
            ))}
          </DropdownMenu.Items>
        </DropdownMenu>
      </Row>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});
