import type { ReaderSettingsActionRowProps } from "./reader-settings-action-row.types";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { UiIcon } from "./ui-icon";
import { UiText as Text } from "./ui-text";
import { uiSize, uiSpace, uiTypography } from "./ui-tokens";

export function ReaderSettingsActionRow({
  accessibilityLabel,
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
  const titleColor = disabled
    ? theme.secondaryText
    : tone === "danger"
      ? "#ff3b30"
      : tone === "accent"
        ? theme.accentStrong
        : theme.controlText;
  const content = (
    <>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: theme.secondaryText }]}>
          {value}
        </Text>
      ) : null}
      {loading ? <ActivityIndicator color={theme.accentStrong} /> : null}
      {showsChevron ? (
        <UiIcon color={theme.secondaryText} name="chevronRight" size={18} />
      ) : null}
    </>
  );
  const rowStyle = [
    styles.row,
    {
      minHeight: description
        ? uiSize.optionRowWithDescription
        : uiSize.optionRow,
    },
  ];

  return onPress ? (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={rowStyle}
    >
      {content}
    </Pressable>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: uiSpace.xxs,
  },
  description: {
    ...uiTypography.optionDescription,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.md,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  title: {
    ...uiTypography.optionLabel,
  },
  value: {
    ...uiTypography.optionValue,
  },
});

export type { ReaderSettingsActionRowProps } from "./reader-settings-action-row.types";
