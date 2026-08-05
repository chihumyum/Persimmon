import type {
  ReaderLayoutMode,
  ReaderPageTurnAnimation,
  ReaderTheme,
} from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReaderSettingsSwitchRow } from "../components/reader-settings-switch-row";
import { uiSize } from "../components/ui-tokens";

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
  return (
    <>
      <ReaderSettingsSwitchRow
        label={t("reader.layout.spreadToggle")}
        theme={theme}
        value={layout === "spread"}
        onChange={(enabled) => onLayoutChange(enabled ? "spread" : "single")}
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
