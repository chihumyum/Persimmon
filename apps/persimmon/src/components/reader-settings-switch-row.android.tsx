import { Column, Host, Row, Switch, Text } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";

import { uiSize, uiTypography } from "./ui-tokens";

interface ReaderSettingsSwitchRowProps {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly theme: ReaderTheme;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}

export function ReaderSettingsSwitchRow({
  description,
  disabled = false,
  label,
  theme,
  value,
  onChange,
}: ReaderSettingsSwitchRowProps) {
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  return (
    <View style={[styles.container, { height: rowHeight }]}>
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
              style={uiTypography.optionLabel}
            >
              {label}
            </Text>
            {description ? (
              <Text
                color={theme.secondaryText}
                style={uiTypography.optionDescription}
              >
                {description}
              </Text>
            ) : undefined}
          </Column>
          <Switch
            enabled={!disabled}
            value={value}
            colors={{
              checkedBorderColor: theme.accent,
              checkedThumbColor: "#ffffff",
              checkedTrackColor: theme.accent,
              uncheckedBorderColor: theme.border,
              uncheckedThumbColor: "#ffffff",
              uncheckedTrackColor: theme.panel,
            }}
            onCheckedChange={onChange}
          />
        </Row>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  host: {
    width: "100%",
  },
});
