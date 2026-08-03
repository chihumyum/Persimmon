import type {
  ReaderLayoutMode,
  ReaderPageTurnAnimation,
  ReaderTheme,
} from "@persimmon/reader-skia";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";

import { UiIcon, type UiIconName } from "../components/ui-icon";
import { UiSegmentedControl } from "../components/ui-segmented-control";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";

interface ReadingPageSettingsProps {
  readonly layout: ReaderLayoutMode;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly rapidPageTurnEnabled: boolean;
  readonly theme: ReaderTheme;
  readonly onAnimationChange: (animation: ReaderPageTurnAnimation) => void;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
  readonly onRapidPageTurnEnabledChange: (enabled: boolean) => void;
}

export function ReadingPageSettings({
  layout,
  pageTurnAnimation,
  rapidPageTurnEnabled,
  theme,
  onAnimationChange,
  onLayoutChange,
  onRapidPageTurnEnabledChange,
}: ReadingPageSettingsProps) {
  const { t } = useTranslation();
  const layoutOptions: readonly {
    readonly value: ReaderLayoutMode;
    readonly label: string;
    readonly description: string;
    readonly icon: UiIconName;
  }[] = [
    {
      value: "single",
      label: t("reader.layout.single"),
      description: t("reader.layout.singleDescription"),
      icon: "singleColumn",
    },
    {
      value: "spread",
      label: t("reader.layout.spread"),
      description: t("reader.layout.spreadDescription"),
      icon: "doubleColumn",
    },
  ];
  const animationOptions: readonly {
    readonly value: ReaderPageTurnAnimation;
    readonly label: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "natural",
      label: t("reader.animation.natural"),
      accessibilityLabel: t("reader.animation.naturalAccessibility"),
    },
    {
      value: "none",
      label: t("reader.animation.none"),
      accessibilityLabel: t("reader.animation.noneAccessibility"),
    },
  ];
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
          {t("reader.layout.section")}
        </Text>
        <View style={styles.optionRow}>
          {layoutOptions.map((option) => {
            const selected = layout === option.value;
            return (
              <Pressable
                key={option.value}
                aria-checked={selected}
                accessibilityLabel={t("reader.layout.optionAccessibility", {
                  label: option.label,
                  description: option.description,
                })}
                accessibilityRole="radio"
                onPress={() => onLayoutChange(option.value)}
                style={[
                  styles.layoutOption,
                  {
                    backgroundColor: selected
                      ? theme.panelRaised
                      : "transparent",
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}
              >
                <UiIcon
                  color={selected ? theme.accentStrong : theme.controlText}
                  name={option.icon}
                  size={25}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: selected ? theme.accentStrong : theme.controlText,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: theme.secondaryText },
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
          {t("reader.animation.section")}
        </Text>
        <UiSegmentedControl
          accessibilityLabel={t("reader.animation.groupAccessibility")}
          options={animationOptions}
          theme={theme}
          value={pageTurnAnimation}
          onChange={onAnimationChange}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
          {t("reader.rapidPageTurn.section")}
        </Text>
        <View
          style={[
            styles.rapidPageTurnRow,
            {
              backgroundColor: theme.panelRaised,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.rapidPageTurnCopy}>
            <Text
              style={[styles.rapidPageTurnTitle, { color: theme.controlText }]}
            >
              {t("reader.rapidPageTurn.title")}
            </Text>
            <Text
              style={[
                styles.rapidPageTurnDescription,
                { color: theme.secondaryText },
              ]}
            >
              {t("reader.rapidPageTurn.description")}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("reader.rapidPageTurn.accessibility")}
            accessibilityRole="switch"
            ios_backgroundColor={theme.panelMuted}
            thumbColor={theme.paper}
            trackColor={{ false: theme.panelMuted, true: theme.accent }}
            value={rapidPageTurnEnabled}
            onValueChange={onRapidPageTurnEnabledChange}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  layoutOption: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: 1,
    flex: 1,
    gap: uiSpace.xxs,
    justifyContent: "center",
    padding: uiSpace.md,
  },
  optionDescription: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: uiSpace.sm + uiSpace.hairline,
  },
  rapidPageTurnCopy: {
    flex: 1,
    gap: uiSpace.xxs,
  },
  rapidPageTurnDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
  rapidPageTurnRow: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: uiSpace.md,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.sm,
  },
  rapidPageTurnTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    gap: uiSpace.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
