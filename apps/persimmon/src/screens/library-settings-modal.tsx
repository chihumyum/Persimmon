import type { ReaderTheme } from "@persimmon/reader-skia";
import Constants from "expo-constants";
import { type ReactNode, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LibraryNativeSheet } from "../components/library-native-sheet";
import { ReaderSettingsActionRow } from "../components/reader-settings-action-row";
import { ReaderSettingsMenuRow } from "../components/reader-settings-menu-row";
import { ReaderSettingsSwitchRow } from "../components/reader-settings-switch-row";
import { SettingsCard } from "../components/settings-card";
import { formatTime, translate, type AppLanguagePreference } from "../i18n";
import {
  licensesDocument,
  privacyDocument,
  type LegalDocument,
} from "../legal/legal-content";
import type { ReaderColorMode, ReaderThemeName } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";
import { uiSize, uiSpace, uiTypography } from "../components/ui-tokens";
import { type DataClearTarget } from "./app-data-settings-section";
import { SettingsDocumentSurface } from "./settings-document-modal";

const DEVELOPER_WEBSITE_URL = "https://chihum.dev";

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
    case "syncing": {
      const progress = status.progress;
      if (progress && progress.totalBooks > 0) {
        if (progress.stage === "finalizing") {
          return translate("sync.description.finalizingBooks", {
            completed: progress.completedBooks,
            total: progress.totalBooks,
          });
        }
        const current = Math.min(
          progress.totalBooks,
          progress.completedBooks + 1,
        );
        return progress.currentBookTitle
          ? translate("sync.description.syncingBook", {
              current,
              total: progress.totalBooks,
              title: progress.currentBookTitle,
            })
          : translate("sync.description.syncingBooks", {
              current,
              total: progress.totalBooks,
            });
      }
      return status.accountEmail
        ? translate("sync.description.syncingAccount", {
            accountEmail: status.accountEmail,
          })
        : translate("sync.description.syncing");
    }
    case "idle":
      return translate("sync.description.idle", {
        account: status.accountEmail ?? "Google Drive",
        time: formatTime(new Date(status.lastSyncedAt)),
      });
    case "reauthorization-required":
    case "error":
      return status.message;
  }
}

function SettingsSection({
  children,
  footer,
  footerCentered = false,
  theme,
  title,
}: {
  readonly children: ReactNode;
  readonly footer?: string;
  readonly footerCentered?: boolean;
  readonly theme: ReaderTheme;
  readonly title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.secondaryText }]}>
        {title}
      </Text>
      <SettingsCard theme={theme}>{children}</SettingsCard>
      {footer ? (
        <Text
          style={[
            styles.sectionFooter,
            footerCentered && styles.sectionFooterCentered,
            { color: theme.secondaryText },
          ]}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

function publicSupportEmail(): string | undefined {
  const configured = Constants.expoConfig?.extra?.supportEmail;
  return typeof configured === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)
    ? configured
    : undefined;
}

export interface LibrarySettingsModalProps {
  readonly bookMetadataVisible: boolean;
  readonly colorMode: ReaderColorMode;
  readonly dataActionsDisabled: boolean;
  readonly dataClearing: DataClearTarget | null;
  readonly languagePreference: AppLanguagePreference;
  readonly readerThemeName: ReaderThemeName;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onBookMetadataVisibleChange: (visible: boolean) => void;
  readonly onClearCloudData: () => void;
  readonly onClearLocalData: () => void;
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
  dataActionsDisabled,
  dataClearing,
  languagePreference,
  readerThemeName,
  syncStatus,
  theme,
  visible,
  onBookMetadataVisibleChange,
  onClearCloudData,
  onClearLocalData,
  onClose,
  onColorModeChange,
  onLanguagePreferenceChange,
  onConnectGoogleDrive,
  onDisconnectGoogleDrive,
  onSyncNow,
  onThemeChange,
}: LibrarySettingsModalProps) {
  const { i18n, t } = useTranslation();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const contentBottomInset = Platform.OS === "android" ? 0 : bottomInset;
  const [legalDocument, setLegalDocument] = useState<LegalDocument>();
  const settingsScrollRef = useRef<ScrollView>(null);
  const settingsScrollOffsetRef = useRef(0);
  const restoreSettingsScrollRef = useRef(false);
  const colorModeOptions = [
    { value: "system", label: t("appearance.colorModes.system") },
    { value: "light", label: t("appearance.colorModes.light") },
    { value: "dark", label: t("appearance.colorModes.dark") },
  ] as const;
  const languageOptions = [
    { value: "system", label: t("language.options.system") },
    { value: "zh-Hans", label: t("language.options.zhHans") },
    { value: "zh-Hant", label: t("language.options.zhHant") },
    { value: "en", label: t("language.options.english") },
    { value: "ja", label: t("language.options.japanese") },
    { value: "ko", label: t("language.options.korean") },
    { value: "es", label: t("language.options.spanish") },
    { value: "fr", label: t("language.options.french") },
    { value: "de", label: t("language.options.german") },
    { value: "pt-BR", label: t("language.options.portugueseBrazil") },
  ] as const;
  const themeOptions = [
    { value: "warm", label: t("appearance.themes.warm") },
    { value: "cool", label: t("appearance.themes.cool") },
  ] as const;
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
  const canClearCloud =
    syncStatus.phase === "idle" ||
    syncStatus.phase === "syncing" ||
    syncStatus.phase === "error";
  const dataBusy = dataClearing !== null;
  const version =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "0.1.0";
  const buildVersion = Constants.nativeBuildVersion;
  const versionLabel = buildVersion ? `${version} (${buildVersion})` : version;
  const supportEmail = publicSupportEmail();
  const syncAccountLabel =
    "accountEmail" in syncStatus && syncStatus.accountEmail
      ? syncStatus.accountEmail
      : "Google Drive";

  const restoreSettingsScrollPosition = () => {
    if (!restoreSettingsScrollRef.current) {
      return;
    }
    settingsScrollRef.current?.scrollTo({
      animated: false,
      y: settingsScrollOffsetRef.current,
    });
    restoreSettingsScrollRef.current = false;
  };

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
  const sendFeedback = async () => {
    const subject = t("settings.about.feedbackSubject", {
      version: versionLabel,
    });
    const message = t("settings.about.feedbackTemplate", {
      version: versionLabel,
      platform: `${Platform.OS} ${String(Platform.Version)}`,
    });
    if (supportEmail) {
      const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      try {
        await Linking.openURL(mailto);
        return;
      } catch {
        // Fall through to the platform share sheet when no mail client exists.
      }
    }
    try {
      await Share.share({ title: t("settings.about.feedback"), message });
    } catch {
      Alert.alert(
        t("settings.about.feedbackFailedTitle"),
        t("settings.about.feedbackFailedMessage"),
      );
    }
  };
  const openDeveloperWebsite = async () => {
    try {
      await Linking.openURL(DEVELOPER_WEBSITE_URL);
    } catch {
      Alert.alert(
        t("settings.developer.websiteFailedTitle"),
        t("settings.developer.websiteFailedMessage"),
      );
    }
  };

  if (legalDocument) {
    return (
      <LibraryNativeSheet
        backAccessibilityLabel={t("common.settings")}
        closeAccessibilityLabel={t("library.settings.closeAccessibility")}
        heightRatio={0.72}
        theme={theme}
        title={legalDocument.title}
        visible={visible}
        onBack={() => {
          restoreSettingsScrollRef.current = true;
          setLegalDocument(undefined);
        }}
        onClose={onClose}
      >
        <SettingsDocumentSurface document={legalDocument} theme={theme} />
      </LibraryNativeSheet>
    );
  }

  return (
    <LibraryNativeSheet
      closeAccessibilityLabel={t("library.settings.closeAccessibility")}
      heightRatio={0.72}
      theme={theme}
      title={t("common.settings")}
      visible={visible}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={[
          styles.settingsList,
          { paddingBottom: contentBottomInset + uiSpace.xxl },
        ]}
        ref={settingsScrollRef}
        showsVerticalScrollIndicator={false}
        style={[styles.host, { backgroundColor: theme.panel }]}
        scrollEventThrottle={16}
        onContentSizeChange={restoreSettingsScrollPosition}
        onScroll={({ nativeEvent }) => {
          settingsScrollOffsetRef.current = nativeEvent.contentOffset.y;
        }}
      >
        <SettingsSection theme={theme} title={t("appearance.section")}>
          <ReaderSettingsMenuRow<ReaderColorMode>
            accessibilityLabel={t("appearance.colorModeGroup")}
            disabled={dataBusy}
            options={colorModeOptions}
            theme={theme}
            title={t("appearance.colorMode")}
            value={colorMode}
            onChange={onColorModeChange}
          />
          <ReaderSettingsMenuRow<AppLanguagePreference>
            accessibilityLabel={t("language.groupAccessibility")}
            description={t(
              languagePreference === "system"
                ? "language.systemDescription"
                : "language.overrideDescription",
            )}
            disabled={dataBusy}
            options={languageOptions}
            theme={theme}
            title={t("language.label")}
            value={languagePreference}
            onChange={onLanguagePreferenceChange}
          />
          <ReaderSettingsMenuRow<ReaderThemeName>
            accessibilityLabel={t("appearance.libraryThemeGroup")}
            disabled={dataBusy}
            options={themeOptions}
            theme={theme}
            title={t("appearance.theme")}
            value={readerThemeName}
            onChange={onThemeChange}
          />
          <ReaderSettingsSwitchRow
            description={t("library.settings.showMetadataDescription")}
            disabled={dataBusy}
            label={t("library.settings.showMetadata")}
            theme={theme}
            value={bookMetadataVisible}
            onChange={onBookMetadataVisibleChange}
          />
        </SettingsSection>

        <SettingsSection theme={theme} title="Google Drive">
          <ReaderSettingsActionRow
            description={syncDescription(syncStatus)}
            loading={busy}
            theme={theme}
            title={syncAccountLabel}
          />
          {canConnect ? (
            <ReaderSettingsActionRow
              disabled={dataBusy}
              theme={theme}
              title={
                syncStatus.phase === "disconnected"
                  ? t("sync.actions.connect")
                  : t("sync.actions.reconnect")
              }
              tone="accent"
              onPress={onConnectGoogleDrive}
            />
          ) : null}
          {canSync ? (
            <ReaderSettingsActionRow
              disabled={dataBusy}
              theme={theme}
              title={t("sync.actions.syncNow")}
              tone="accent"
              onPress={onSyncNow}
            />
          ) : null}
          {canDisconnect ? (
            <ReaderSettingsActionRow
              disabled={dataBusy}
              theme={theme}
              title={t("sync.actions.disconnect")}
              tone="danger"
              onPress={onDisconnectGoogleDrive}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection
          footer={t("settings.data.sectionDescription")}
          theme={theme}
          title={t("settings.data.section")}
        >
          <ReaderSettingsActionRow
            description={t("settings.data.clearLocalDescription")}
            disabled={dataActionsDisabled || dataBusy}
            loading={dataClearing === "local"}
            theme={theme}
            title={t("settings.data.clearLocalTitle")}
            tone="danger"
            onPress={confirmClearLocalData}
          />
          <ReaderSettingsActionRow
            description={t(
              canClearCloud
                ? "settings.data.clearCloudDescription"
                : "settings.data.clearCloudDisconnectedDescription",
            )}
            disabled={dataActionsDisabled || dataBusy || !canClearCloud}
            loading={dataClearing === "cloud"}
            theme={theme}
            title={t("settings.data.clearCloudTitle")}
            tone="danger"
            onPress={confirmClearCloudData}
          />
        </SettingsSection>

        <SettingsSection
          footer={t("settings.about.copyright")}
          footerCentered
          theme={theme}
          title={t("settings.about.section")}
        >
          <ReaderSettingsActionRow
            showsChevron
            theme={theme}
            title={t("settings.about.privacy")}
            onPress={() =>
              setLegalDocument(privacyDocument(i18n.resolvedLanguage))
            }
          />
          <ReaderSettingsActionRow
            description={
              supportEmail
                ? t("settings.about.feedbackEmailDescription", {
                    email: supportEmail,
                  })
                : t("settings.about.feedbackDescription")
            }
            showsChevron
            theme={theme}
            title={t("settings.about.feedback")}
            onPress={() => void sendFeedback()}
          />
          <ReaderSettingsActionRow
            showsChevron
            theme={theme}
            title={t("settings.about.licenses")}
            onPress={() =>
              setLegalDocument(licensesDocument(i18n.resolvedLanguage))
            }
          />
          <ReaderSettingsActionRow
            theme={theme}
            title={t("settings.about.version")}
            value={versionLabel}
          />
          <ReaderSettingsActionRow
            accessibilityLabel={t("settings.developer.websiteAccessibility")}
            showsChevron
            theme={theme}
            title={t("settings.developer.label")}
            tone="accent"
            onPress={() => void openDeveloperWebsite()}
          />
        </SettingsSection>
      </ScrollView>
    </LibraryNativeSheet>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    width: "100%",
  },
  section: {
    gap: uiSpace.sm,
  },
  sectionFooter: {
    ...uiTypography.optionDescription,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  sectionFooterCentered: {
    textAlign: "center",
  },
  sectionTitle: {
    ...uiTypography.sectionTitle,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  settingsList: {
    gap: uiSpace.xl,
    paddingHorizontal: uiSpace.lg,
    paddingTop: uiSpace.sm,
  },
});
