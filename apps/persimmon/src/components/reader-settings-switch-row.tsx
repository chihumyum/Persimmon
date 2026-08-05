import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, Switch, View } from "react-native";

import { UiText as Text } from "./ui-text";
import { uiSize, uiSpace, uiTypography } from "./ui-tokens";

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
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: theme.controlText }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        ios_backgroundColor={theme.panelMuted}
        thumbColor={theme.paper}
        trackColor={{ false: theme.panelMuted, true: theme.accent }}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
  },
  description: {
    ...uiTypography.optionDescription,
  },
  label: {
    ...uiTypography.optionLabel,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.md,
    minHeight: uiSize.optionRow,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
});
