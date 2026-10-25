import type {
  ReaderPageTurnAnimation,
  ReaderTheme,
} from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReaderSettingsMenuRow } from "../components/reader-settings-menu-row";
import { ReaderSettingsSwitchRow } from "../components/reader-settings-switch-row";
import { uiSize } from "../components/ui-tokens";
import type { ReaderLayoutPreference } from "../library/types";

interface ReadingPageSettingsProps {
  readonly layoutPreference: ReaderLayoutPreference;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly rapidPageTurnEnabled: boolean;
  readonly theme: ReaderTheme;
  readonly onAnimationChange: (animation: ReaderPageTurnAnimation) => void;
  readonly onLayoutPreferenceChange: (
    preference: ReaderLayoutPreference,
  ) => void;
  readonly onRapidPageTurnEnabledChange: (enabled: boolean) => void;
}

export function ReadingPageSettings({
  layoutPreference,
  pageTurnAnimation,
  rapidPageTurnEnabled,
  theme,
  onAnimationChange,
  onLayoutPreferenceChange,
  onRapidPageTurnEnabledChange,
}: ReadingPageSettingsProps) {
  const { t } = useTranslation();
  const layoutOptions: readonly {
    readonly value: ReaderLayoutPreference;
    readonly label: string;
  }[] = [
    { value: "auto", label: t("reader.layout.auto") },
    { value: "single", label: t("reader.layout.single") },
    { value: "spread", label: t("reader.layout.spread") },
  ];
  const layoutLabel =
    layoutOptions.find((option) => option.value === layoutPreference)?.label ??
    layoutOptions[0]!.label;
  return (
    <>
      <ReaderSettingsMenuRow<ReaderLayoutPreference>
        accessibilityLabel={t("reader.layout.valueAccessibility", {
          value: layoutLabel,
        })}
        options={layoutOptions}
        theme={theme}
        title={t("reader.layout.title")}
        value={layoutPreference}
        onChange={onLayoutPreferenceChange}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <ReaderSettingsSwitchRow
        label={t("reader.animation.natural")}
        theme={theme}
        value={pageTurnAnimation === "natural"}
        onChange={(enabled) => onAnimationChange(enabled ? "natural" : "none")}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <ReaderSettingsSwitchRow
        label={t("reader.rapidPageTurn.title")}
        theme={theme}
        value={rapidPageTurnEnabled}
        onChange={onRapidPageTurnEnabledChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: uiSize.dividerHorizontalInset,
  },
});
