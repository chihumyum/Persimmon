import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { UiButton } from "../components/ui-button";
import { UiModalSurface } from "../components/ui-modal-surface";
import { ReaderThemeSelector } from "../components/reader-theme-selector";
import { UiSegmentedControl } from "../components/ui-segmented-control";
import { uiBackdropColor } from "../components/ui-shadow";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";
import { formatTime, translate, type AppLanguagePreference } from "../i18n";
import type { ReaderColorMode, ReaderThemeName } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";

export function syncDescription(status: GoogleDriveSyncStatus): string {
  switch (status.phase) {
    case "loading":
      return translate("sync.description.loading");
    case "unconfigured":
      return status.message;
    case "disconnected":
      return translate("sync.description.disconnected");
    case "authorizing":
      return translate("sync.description.authorizing");
    case "syncing":
      return status.accountEmail
        ? translate("sync.description.syncingAccount", {
            accountEmail: status.accountEmail,
          })
        : translate("sync.description.syncing");
    case "idle": {
      return translate("sync.description.idle", {
        account: status.accountEmail ?? "Google Drive",
        time: formatTime(new Date(status.lastSyncedAt)),
      });
    }
    case "reauthorization-required":
    case "error":
      return status.message;
  }
}

export interface LibrarySettingsModalProps {
  readonly bookMetadataVisible: boolean;
  readonly colorMode: ReaderColorMode;
  readonly languagePreference: AppLanguagePreference;
  readonly readerThemeName: ReaderThemeName;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onBookMetadataVisibleChange: (visible: boolean) => void;
  readonly onClose: () => void;
  readonly onColorModeChange: (mode: ReaderColorMode) => void;
  readonly onLanguagePreferenceChange: (
    preference: AppLanguagePreference,
  ) => void;
  readonly onConnectGoogleDrive: () => void;
  readonly onDisconnectGoogleDrive: () => void;
  readonly onSyncNow: () => void;
  readonly onThemeChange: (theme: ReaderThemeName) => void;
}

export function LibrarySettingsModal({
  bookMetadataVisible,
  colorMode,
  languagePreference,
  readerThemeName,
  syncStatus,
  theme,
  visible,
  onBookMetadataVisibleChange,
  onClose,
  onColorModeChange,
  onLanguagePreferenceChange,
  onConnectGoogleDrive,
  onDisconnectGoogleDrive,
  onSyncNow,
  onThemeChange,
}: LibrarySettingsModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colorModeOptions: readonly {
    readonly value: ReaderColorMode;
    readonly label: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "system",
      label: t("appearance.colorModes.system"),
      accessibilityLabel: t("appearance.colorModes.systemAccessibility"),
    },
    {
      value: "light",
      label: t("appearance.colorModes.light"),
      accessibilityLabel: t("appearance.colorModes.lightAccessibility"),
    },
    {
      value: "dark",
      label: t("appearance.colorModes.dark"),
      accessibilityLabel: t("appearance.colorModes.darkAccessibility"),
    },
  ];
  const languageOptions: readonly {
    readonly value: AppLanguagePreference;
    readonly label: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "system",
      label: t("language.options.system"),
      accessibilityLabel: t("language.options.systemAccessibility"),
    },
    {
      value: "zh-Hans",
      label: t("language.options.zhHans"),
      accessibilityLabel: t("language.options.zhHansAccessibility"),
    },
    {
      value: "en",
      label: t("language.options.english"),
      accessibilityLabel: t("language.options.englishAccessibility"),
    },
  ];
  const busy =
    syncStatus.phase === "loading" ||
    syncStatus.phase === "authorizing" ||
    syncStatus.phase === "syncing";
  const canConnect =
    syncStatus.phase === "disconnected" ||
    syncStatus.phase === "reauthorization-required";
  const canSync = syncStatus.phase === "idle" || syncStatus.phase === "error";
  const canDisconnect =
    syncStatus.phase === "idle" ||
    syncStatus.phase === "syncing" ||
    syncStatus.phase === "error" ||
    syncStatus.phase === "reauthorization-required";

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.modalRoot,
          {
            backgroundColor: uiBackdropColor(theme),
            paddingBottom: Math.max(insets.bottom, 14),
            paddingTop: Math.max(insets.top, 14),
          },
        ]}
      >
        <Pressable
          accessibilityLabel={t("library.settings.closeAccessibility")}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <UiModalSurface theme={theme}>
          <View style={styles.header}>
            <Text variant="modalTitle" style={{ color: theme.text }}>
              {t("common.settings")}
            </Text>
            <UiButton
              compact
              label={t("common.done")}
              onPress={onClose}
              textTone="accent"
              theme={theme}
              variant="ghost"
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.controlText }]}>
                {t("appearance.section")}
              </Text>
              <View style={styles.appearanceControl}>
                <Text
                  style={[styles.appearanceLabel, { color: theme.controlText }]}
                >
                  {t("appearance.colorMode")}
                </Text>
                <UiSegmentedControl
                  accessibilityLabel={t("appearance.colorModeGroup")}
                  options={colorModeOptions}
                  theme={theme}
                  value={colorMode}
                  onChange={onColorModeChange}
                />
              </View>
              <View style={styles.appearanceControl}>
                <Text
                  style={[styles.appearanceLabel, { color: theme.controlText }]}
                >
                  {t("language.label")}
                </Text>
                <UiSegmentedControl
                  accessibilityLabel={t("language.groupAccessibility")}
                  options={languageOptions}
                  theme={theme}
                  value={languagePreference}
                  onChange={onLanguagePreferenceChange}
                />
                <Text
                  style={[
                    styles.preferenceHint,
                    { color: theme.secondaryText },
                  ]}
                >
                  {t(
                    languagePreference === "system"
                      ? "language.systemDescription"
                      : "language.overrideDescription",
                  )}
                </Text>
              </View>
              <View style={styles.appearanceControl}>
                <Text
                  style={[styles.appearanceLabel, { color: theme.controlText }]}
                >
                  {t("appearance.theme")}
                </Text>
                <ReaderThemeSelector
                  accessibilityLabel={t("appearance.libraryThemeGroup")}
                  theme={theme}
                  value={readerThemeName}
                  onChange={onThemeChange}
                />
              </View>
              <View
                style={[
                  styles.preferenceRow,
                  {
                    backgroundColor: theme.panelRaised,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.preferenceCopy}>
                  <Text
                    style={[
                      styles.preferenceTitle,
                      { color: theme.controlText },
                    ]}
                  >
                    {t("library.settings.showMetadata")}
                  </Text>
                  <Text
                    style={[
                      styles.preferenceBody,
                      { color: theme.secondaryText },
                    ]}
                  >
                    {t("library.settings.showMetadataDescription")}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={t(
                    "library.settings.showMetadataAccessibility",
                  )}
                  onValueChange={onBookMetadataVisibleChange}
                  thumbColor={
                    Platform.OS === "android" ? theme.panelRaised : undefined
                  }
                  trackColor={{
                    false: theme.panelMuted,
                    true: theme.accent,
                  }}
                  value={bookMetadataVisible}
                />
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.section}>
              <View style={styles.syncHeading}>
                <View style={styles.syncHeadingCopy}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Google Drive
                  </Text>
                  <Text
                    style={[styles.sectionBody, { color: theme.secondaryText }]}
                  >
                    {syncDescription(syncStatus)}
                  </Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : null}
              </View>

              <View style={styles.actionRow}>
                {canConnect ? (
                  <UiButton
                    label={
                      syncStatus.phase === "disconnected"
                        ? t("sync.actions.connect")
                        : t("sync.actions.reconnect")
                    }
                    onPress={onConnectGoogleDrive}
                    theme={theme}
                    variant="primary"
                  />
                ) : null}
                {canSync ? (
                  <UiButton
                    label={t("sync.actions.syncNow")}
                    onPress={onSyncNow}
                    theme={theme}
                  />
                ) : null}
                {canDisconnect ? (
                  <UiButton
                    label={t("sync.actions.disconnect")}
                    onPress={onDisconnectGoogleDrive}
                    textTone="muted"
                    theme={theme}
                    variant="ghost"
                  />
                ) : null}
              </View>
            </View>
          </ScrollView>
        </UiModalSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  appearanceControl: {
    gap: 6,
  },
  appearanceLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  content: {
    gap: 20,
    paddingBottom: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: uiSpace.lg,
  },
  modalRoot: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  preferenceBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  preferenceCopy: {
    flex: 1,
    paddingRight: 10,
  },
  preferenceHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  preferenceRow: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    marginTop: 5,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  preferenceTitle: {
    fontSize: 13,
    fontWeight: "600",
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
  syncHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  syncHeadingCopy: {
    flex: 1,
  },
});
