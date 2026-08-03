import type { ReaderTheme } from "@persimmon/reader-skia";
import { Alert, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { UiButton } from "../components/ui-button";
import { UiText as Text } from "../components/ui-text";
import { uiRadius } from "../components/ui-tokens";

export type DataClearTarget = "local" | "cloud";

export function AppDataSettingsSection({
  canClearCloud,
  dataActionsDisabled,
  dataClearing,
  theme,
  onClearCloudData,
  onClearLocalData,
}: {
  readonly canClearCloud: boolean;
  readonly dataActionsDisabled: boolean;
  readonly dataClearing: DataClearTarget | null;
  readonly theme: ReaderTheme;
  readonly onClearCloudData: () => void;
  readonly onClearLocalData: () => void;
}) {
  const { t } = useTranslation();
  const dataBusy = dataClearing !== null;
  const confirmClearLocalData = () => {
    Alert.alert(
      t("settings.data.clearLocalTitle"),
      t("settings.data.clearLocalConfirmation"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.data.clearLocalAction"),
          style: "destructive",
          onPress: onClearLocalData,
        },
      ],
    );
  };
  const confirmClearCloudData = () => {
    Alert.alert(
      t("settings.data.clearCloudTitle"),
      t("settings.data.clearCloudConfirmation"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.data.clearCloudAction"),
          style: "destructive",
          onPress: onClearCloudData,
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {t("settings.data.section")}
      </Text>
      <Text style={[styles.sectionBody, { color: theme.secondaryText }]}>
        {t("settings.data.sectionDescription")}
      </Text>
      <View
        style={[
          styles.dataAction,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.actionCopy}>
          <Text style={[styles.actionTitle, { color: theme.controlText }]}>
            {t("settings.data.clearLocalTitle")}
          </Text>
          <Text style={[styles.actionBody, { color: theme.secondaryText }]}>
            {t("settings.data.clearLocalDescription")}
          </Text>
        </View>
        <UiButton
          compact
          disabled={dataActionsDisabled || dataBusy}
          label={t("settings.data.clearLocalAction")}
          loading={dataClearing === "local"}
          onPress={confirmClearLocalData}
          textTone="danger"
          theme={theme}
          variant="ghost"
        />
      </View>
      <View
        style={[
          styles.dataAction,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.actionCopy}>
          <Text style={[styles.actionTitle, { color: theme.controlText }]}>
            {t("settings.data.clearCloudTitle")}
          </Text>
          <Text style={[styles.actionBody, { color: theme.secondaryText }]}>
            {t(
              canClearCloud
                ? "settings.data.clearCloudDescription"
                : "settings.data.clearCloudDisconnectedDescription",
            )}
          </Text>
        </View>
        <UiButton
          compact
          disabled={dataActionsDisabled || dataBusy || !canClearCloud}
          label={t("settings.data.clearCloudAction")}
          loading={dataClearing === "cloud"}
          onPress={confirmClearCloudData}
          textTone="danger"
          theme={theme}
          variant="ghost"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  actionCopy: {
    flex: 1,
    paddingRight: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  dataAction: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  section: {
    gap: 12,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
});
