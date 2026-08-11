import type { ReaderTheme } from "@persimmon/reader-skia";
import Constants from "expo-constants";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { UiIcon } from "../components/ui-icon";
import { UiText as Text } from "../components/ui-text";
import { uiRadius } from "../components/ui-tokens";
import {
  licensesDocument,
  PRIVACY_POLICY_URL,
  privacyDocument,
  type LegalDocument,
} from "../legal/legal-content";

function SettingsLinkRow({
  label,
  detail,
  value,
  theme,
  onPress,
}: {
  readonly label: string;
  readonly detail?: string;
  readonly value?: string;
  readonly theme: ReaderTheme;
  readonly onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        {
          backgroundColor: pressed ? theme.panelMuted : theme.panelRaised,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.linkCopy}>
        <Text style={[styles.rowTitle, { color: theme.controlText }]}>
          {label}
        </Text>
        {detail ? (
          <Text style={[styles.rowBody, { color: theme.secondaryText }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.linkValue, { color: theme.secondaryText }]}>
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <UiIcon color={theme.secondaryText} name="chevronRight" size={18} />
      ) : null}
    </Pressable>
  );
}

function publicSupportEmail(): string | undefined {
  const configured = Constants.expoConfig?.extra?.supportEmail;
  return typeof configured === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)
    ? configured
    : undefined;
}

export function AppAboutSettingsSection({
  theme,
  onOpenDocument,
}: {
  readonly theme: ReaderTheme;
  readonly onOpenDocument: (document: LegalDocument) => void;
}) {
  const { i18n, t } = useTranslation();
  const version =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "0.1.0";
  const buildVersion = Constants.nativeBuildVersion;
  const versionLabel = buildVersion ? `${version} (${buildVersion})` : version;
  const supportEmail = publicSupportEmail();

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      onOpenDocument(privacyDocument(i18n.resolvedLanguage));
    }
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
        // Devices without an email handler can still use the share sheet.
      }
    }
    try {
      await Share.share({
        title: t("settings.about.feedback"),
        message,
      });
    } catch {
      Alert.alert(
        t("settings.about.feedbackFailedTitle"),
        t("settings.about.feedbackFailedMessage"),
      );
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {t("settings.about.section")}
      </Text>
      <View style={styles.linkGroup}>
        <SettingsLinkRow
          label={t("settings.about.privacy")}
          onPress={() => void openPrivacyPolicy()}
          theme={theme}
        />
        <SettingsLinkRow
          detail={
            supportEmail
              ? t("settings.about.feedbackEmailDescription", {
                  email: supportEmail,
                })
              : t("settings.about.feedbackDescription")
          }
          label={t("settings.about.feedback")}
          onPress={() => void sendFeedback()}
          theme={theme}
        />
        <SettingsLinkRow
          label={t("settings.about.licenses")}
          onPress={() =>
            onOpenDocument(licensesDocument(i18n.resolvedLanguage))
          }
          theme={theme}
        />
        <SettingsLinkRow
          label={t("settings.about.version")}
          theme={theme}
          value={versionLabel}
        />
      </View>
      <Text style={[styles.copyright, { color: theme.secondaryText }]}>
        {t("settings.about.copyright")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  copyright: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  linkCopy: {
    flex: 1,
  },
  linkGroup: {
    gap: 7,
  },
  linkRow: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  linkValue: {
    fontSize: 12,
    marginHorizontal: 8,
  },
  rowBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
});
