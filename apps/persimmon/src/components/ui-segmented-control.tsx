import type { ReaderTheme } from "@persimmon/reader-skia";
import { Pressable, StyleSheet, View } from "react-native";

import { UiText } from "./ui-text";
import { uiRadius, uiSize, uiSpace } from "./ui-tokens";

export interface UiSegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly accessibilityLabel?: string;
}

export interface UiSegmentedControlProps<Value extends string> {
  readonly accessibilityLabel: string;
  readonly options: readonly UiSegmentedOption<Value>[];
  readonly theme: ReaderTheme;
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

export function UiSegmentedControl<Value extends string>({
  accessibilityLabel,
  options,
  theme,
  value,
  onChange,
}: UiSegmentedControlProps<Value>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[
        styles.group,
        {
          backgroundColor: theme.panelMuted,
          borderColor: `${theme.border}80`,
        },
      ]}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && {
                backgroundColor: theme.panelRaised,
                borderColor: theme.accent,
              },
              pressed && !selected && { backgroundColor: theme.panel },
            ]}
          >
            <UiText
              variant="button"
              style={{
                color: selected ? theme.accentStrong : theme.secondaryText,
              }}
            >
              {option.label}
            </UiText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: uiSpace.xxs,
    padding: uiSpace.xxs + uiSpace.hairline,
  },
  option: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: uiRadius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: "center",
    minHeight: uiSize.minimumHitTarget - uiSpace.xxs,
    paddingHorizontal: uiSpace.xs,
  },
});
