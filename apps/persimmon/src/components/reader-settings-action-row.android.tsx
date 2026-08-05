import {
  CircularProgressIndicator,
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
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet } from "react-native";

import chevronRightIcon from "../assets/icons/chevron_right.xml";
import type { ReaderSettingsActionRowProps } from "./reader-settings-action-row.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function ReaderSettingsActionRow({
  accessibilityLabel: _accessibilityLabel,
  description,
  disabled = false,
  loading = false,
  showsChevron = false,
  theme,
  title,
  tone = "default",
  value,
  onPress,
}: ReaderSettingsActionRowProps) {
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  const titleColor = disabled
    ? theme.secondaryText
    : tone === "danger"
      ? "#f44336"
      : tone === "accent"
        ? theme.accentStrong
        : theme.controlText;

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
          padding(
            uiSize.optionHorizontalInset,
            0,
            uiSize.optionHorizontalInset,
            0,
          ),
          ...(onPress && !disabled ? [clickable(onPress)] : []),
        ]}
      >
        <Column modifiers={[weight(1)]} verticalArrangement="center">
          <Text
            color={titleColor}
            maxLines={2}
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
        {value ? (
          <Text
            color={theme.secondaryText}
            maxLines={1}
            style={uiTypography.optionValue}
          >
            {value}
          </Text>
        ) : undefined}
        {loading ? (
          <CircularProgressIndicator
            color={theme.accentStrong}
            modifiers={[size(22, 22)]}
            strokeWidth={2.5}
          />
        ) : undefined}
        {showsChevron ? (
          <Icon
            contentDescription={undefined}
            size={19}
            source={chevronRightIcon}
            tint={theme.secondaryText}
          />
        ) : undefined}
      </Row>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});

export type { ReaderSettingsActionRowProps } from "./reader-settings-action-row.types";
