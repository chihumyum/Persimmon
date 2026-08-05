import MenuView, { type MenuAction } from "@expo/ui/community/menu";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";

import { UiIcon } from "./ui-icon";
import { UiText as Text } from "./ui-text";
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
  accessibilityLabel,
  description,
  disabled = false,
  options,
  theme,
  title,
  value,
  onChange,
}: ReaderSettingsMenuRowProps<Value>) {
  const actions: MenuAction[] = options.map((option) => ({
    id: option.value,
    state: option.value === value ? "on" : "off",
    title: option.label,
  }));
  const selected = options.find((option) => option.value === value);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          minHeight: description
            ? uiSize.optionRowWithDescription
            : uiSize.optionRow,
        },
      ]}
    >
      <View style={styles.copy}>
        <Text
          style={[
            styles.title,
            { color: disabled ? theme.secondaryText : theme.controlText },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <View pointerEvents={disabled ? "none" : "auto"} style={styles.trigger}>
        <MenuView
          actions={actions}
          colorScheme={theme.colorScheme}
          onPressAction={({ nativeEvent }) =>
            onChange(nativeEvent.event as Value)
          }
        >
          <View accessibilityRole="button" style={styles.value}>
            <Text
              style={[uiTypography.optionValue, { color: theme.secondaryText }]}
            >
              {selected?.label ?? value}
            </Text>
            <UiIcon color={theme.secondaryText} name="chevronDown" size={18} />
          </View>
        </MenuView>
      </View>
    </View>
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
    minHeight: uiSize.optionRow,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  title: {
    ...uiTypography.optionLabel,
  },
  trigger: {
    marginLeft: "auto",
  },
  value: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.xxs,
  },
});
