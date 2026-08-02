import {
  resolveReaderTheme,
  type ReaderTheme,
  type ReaderThemeName,
} from "@persimmon/reader-skia";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { UiIcon } from "./ui-icon";
import { UiText as Text } from "./ui-text";
import { uiSpace } from "./ui-tokens";

export interface ReaderThemeSelectorProps {
  readonly accessibilityLabel?: string;
  readonly theme: ReaderTheme;
  readonly value: ReaderThemeName;
  readonly onChange: (theme: ReaderThemeName) => void;
}

export function ReaderThemeSelector({
  accessibilityLabel,
  theme,
  value,
  onChange,
}: ReaderThemeSelectorProps) {
  const { t } = useTranslation();
  const options: readonly {
    readonly value: ReaderThemeName;
    readonly label: string;
    readonly description: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "warm",
      label: t("appearance.themes.warm"),
      description: t("appearance.themes.warmDescription"),
      accessibilityLabel: t("appearance.themes.warmAccessibility"),
    },
    {
      value: "cool",
      label: t("appearance.themes.cool"),
      description: t("appearance.themes.coolDescription"),
      accessibilityLabel: t("appearance.themes.coolAccessibility"),
    },
  ];
  return (
    <View
      accessibilityLabel={
        accessibilityLabel ?? t("appearance.readerThemeGroup")
      }
      accessibilityRole="radiogroup"
      style={styles.options}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const lightPreview = resolveReaderTheme(option.value, "light");
        const darkPreview = resolveReaderTheme(option.value, "dark");
        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected ? theme.panelRaised : "transparent",
                borderColor: selected ? theme.accent : theme.border,
              },
              pressed && { backgroundColor: theme.panelMuted },
            ]}
          >
            <View style={styles.preview}>
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: lightPreview.paper,
                    borderColor: lightPreview.divider,
                  },
                ]}
              />
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: darkPreview.paper,
                    borderColor: darkPreview.divider,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: selected ? theme.accentStrong : theme.controlText,
                },
              ]}
            >
              {option.label}
            </Text>
            <Text style={[styles.description, { color: theme.secondaryText }]}>
              {option.description}
            </Text>
            {selected ? (
              <UiIcon
                color={theme.accentStrong}
                name="check"
                size={13}
                style={styles.check}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  check: {
    position: "absolute",
    right: 7,
    top: 7,
  },
  description: {
    fontSize: 9,
    lineHeight: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  option: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 3,
    minHeight: 74,
    paddingHorizontal: 9,
    paddingVertical: 8,
    position: "relative",
  },
  options: {
    flexDirection: "row",
    gap: uiSpace.sm,
  },
  preview: {
    flexDirection: "row",
    marginBottom: 2,
  },
  swatch: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 20,
    marginRight: -4,
    width: 20,
  },
});
