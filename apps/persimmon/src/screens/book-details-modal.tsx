import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LibraryNativeSheet } from "../components/library-native-sheet";
import { ReaderSettingsActionRow } from "../components/reader-settings-action-row";
import { SettingsCard } from "../components/settings-card";
import { UiText as Text } from "../components/ui-text";
import { uiSize, uiSpace } from "../components/ui-tokens";
import { formatByteCount, formatDate, formatPercentage } from "../i18n";
import { readingProgressPercent } from "../library/library-view";
import type { LibraryBookSummary } from "../library/repository";

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : formatDate(date, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export interface BookDetailsModalProps {
  readonly entry?: LibraryBookSummary;
  readonly theme: ReaderTheme;
  readonly onClose: () => void;
  readonly onDelete: (entry: LibraryBookSummary) => void;
  readonly onExport: (entry: LibraryBookSummary) => Promise<void>;
  readonly onOpen: (bookId: string) => void;
  readonly onSync: (entry: LibraryBookSummary) => void;
}

export function BookDetailsModal({
  entry,
  theme,
  onClose,
  onDelete,
  onExport,
  onOpen,
  onSync,
}: BookDetailsModalProps) {
  const { t } = useTranslation();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const contentBottomInset = Platform.OS === "android" ? 0 : bottomInset;
  const [displayEntry, setDisplayEntry] = useState(entry);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (entry) {
      setDisplayEntry(entry);
      setExporting(false);
    }
  }, [entry]);

  if (!displayEntry) return null;

  return (
    <LibraryNativeSheet
      closeAccessibilityLabel={t("library.details.closeAccessibility")}
      heightRatio={0.72}
      theme={theme}
      title={t("library.details.title")}
      visible={Boolean(entry)}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomInset + uiSpace.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        style={[styles.host, { backgroundColor: theme.panel }]}
      >
        <View style={styles.identity}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={{ color: theme.text }}
            variant="panelTitle"
          >
            {displayEntry.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: theme.secondaryText }}
            variant="optionDescription"
          >
            {displayEntry.author ?? t("common.unknownAuthor")}
          </Text>
        </View>

        <SettingsCard theme={theme}>
          <ReaderSettingsActionRow
            theme={theme}
            title={t("library.details.progress")}
            value={
              displayEntry.locator
                ? formatPercentage(readingProgressPercent(displayEntry))
                : t("library.details.notStarted")
            }
          />
          <ReaderSettingsActionRow
            theme={theme}
            title={t("library.details.localStatus")}
            value={
              displayEntry.status === "ready"
                ? t("library.details.downloaded")
                : t("library.details.needsDownload")
            }
          />
          <ReaderSettingsActionRow
            theme={theme}
            title={t("library.details.file")}
            value={
              displayEntry.sourceName === "旧版导入" ||
              displayEntry.sourceName === "Legacy import"
                ? t("library.details.legacyImport")
                : displayEntry.sourceName
            }
            wrapsValue
          />
          <ReaderSettingsActionRow
            theme={theme}
            title={t("library.details.size")}
            value={
              displayEntry.builtIn
                ? t("library.details.builtIn")
                : formatByteCount(displayEntry.originalByteLength)
            }
          />
          <ReaderSettingsActionRow
            theme={theme}
            title={t("library.details.added")}
            value={dateLabel(displayEntry.addedAt)}
          />
        </SettingsCard>

        {displayEntry.status === "ready" || !displayEntry.builtIn ? (
          <SettingsCard theme={theme}>
            {displayEntry.status === "ready" ? (
              <ReaderSettingsActionRow
                theme={theme}
                title={t("library.details.continueReading")}
                tone="accent"
                onPress={() => {
                  onClose();
                  onOpen(displayEntry.id);
                }}
              />
            ) : null}
            {!displayEntry.builtIn ? (
              <ReaderSettingsActionRow
                theme={theme}
                title={
                  displayEntry.status === "ready"
                    ? t("library.actions.syncNow")
                    : t("library.actions.downloadFromCloud")
                }
                tone="accent"
                onPress={() => {
                  onClose();
                  onSync(displayEntry);
                }}
              />
            ) : null}
            {displayEntry.status === "ready" && !displayEntry.builtIn ? (
              <ReaderSettingsActionRow
                disabled={exporting}
                loading={exporting}
                theme={theme}
                title={t("library.details.exportEpub")}
                onPress={() => {
                  setExporting(true);
                  void onExport(displayEntry)
                    .catch(() => undefined)
                    .finally(() => {
                      setExporting(false);
                    });
                }}
              />
            ) : null}
            {!displayEntry.builtIn ? (
              <ReaderSettingsActionRow
                theme={theme}
                title={t("library.details.deleteEverywhere")}
                tone="danger"
                onPress={() => {
                  onClose();
                  onDelete(displayEntry);
                }}
              />
            ) : null}
          </SettingsCard>
        ) : null}
      </ScrollView>
    </LibraryNativeSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: uiSpace.xl,
    paddingHorizontal: uiSpace.lg,
    paddingTop: uiSpace.sm,
  },
  host: { flex: 1, width: "100%" },
  identity: {
    gap: uiSpace.xs,
    paddingHorizontal: uiSize.optionHorizontalInset,
    paddingVertical: uiSpace.sm,
  },
});
