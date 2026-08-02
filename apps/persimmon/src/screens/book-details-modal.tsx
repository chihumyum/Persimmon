import type { ReaderTheme } from "@persimmon/reader-skia";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { UiButton } from "../components/ui-button";
import { UiModalSurface } from "../components/ui-modal-surface";
import { uiBackdropColor } from "../components/ui-shadow";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";
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

function DetailRow({
  label,
  theme,
  value,
}: {
  readonly label: string;
  readonly theme: ReaderTheme;
  readonly value: string;
}) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
      <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>
        {label}
      </Text>
      <Text
        selectable
        style={[styles.detailValue, { color: theme.controlText }]}
      >
        {value}
      </Text>
    </View>
  );
}

export interface BookDetailsModalProps {
  readonly entry?: LibraryBookSummary;
  readonly theme: ReaderTheme;
  readonly onClose: () => void;
  readonly onDelete: (entry: LibraryBookSummary) => void;
  readonly onOpen: (bookId: string) => void;
  readonly onSync: (entry: LibraryBookSummary) => void;
}

export function BookDetailsModal({
  entry,
  theme,
  onClose,
  onDelete,
  onOpen,
  onSync,
}: BookDetailsModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!entry) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
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
          accessibilityLabel={t("library.details.closeAccessibility")}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <UiModalSurface theme={theme}>
          <View style={styles.header}>
            <Text variant="panelTitle" style={{ color: theme.text }}>
              {t("library.details.title")}
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

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.bookTitle, { color: theme.text }]}>
              {entry.title}
            </Text>
            <Text style={[styles.author, { color: theme.secondaryText }]}>
              {entry.author ?? t("common.unknownAuthor")}
            </Text>

            <View
              style={[
                styles.details,
                {
                  backgroundColor: theme.panelRaised,
                  borderColor: theme.border,
                },
              ]}
            >
              <DetailRow
                label={t("library.details.progress")}
                theme={theme}
                value={
                  entry.locator
                    ? formatPercentage(readingProgressPercent(entry))
                    : t("library.details.notStarted")
                }
              />
              <DetailRow
                label={t("library.details.localStatus")}
                theme={theme}
                value={
                  entry.status === "ready"
                    ? t("library.details.downloaded")
                    : t("library.details.needsDownload")
                }
              />
              <DetailRow
                label={t("library.details.file")}
                theme={theme}
                value={
                  entry.sourceName === "旧版导入" ||
                  entry.sourceName === "Legacy import"
                    ? t("library.details.legacyImport")
                    : entry.sourceName
                }
              />
              <DetailRow
                label={t("library.details.size")}
                theme={theme}
                value={
                  entry.builtIn
                    ? t("library.details.builtIn")
                    : formatByteCount(entry.originalByteLength)
                }
              />
              <DetailRow
                label={t("library.details.added")}
                theme={theme}
                value={dateLabel(entry.addedAt)}
              />
            </View>

            <View style={styles.actions}>
              {entry.status === "ready" ? (
                <UiButton
                  label={t("library.details.continueReading")}
                  onPress={() => {
                    onClose();
                    onOpen(entry.id);
                  }}
                  theme={theme}
                  variant="primary"
                />
              ) : null}
              {!entry.builtIn ? (
                <UiButton
                  label={
                    entry.status === "ready"
                      ? t("library.actions.syncNow")
                      : t("library.actions.downloadFromCloud")
                  }
                  onPress={() => {
                    onClose();
                    onSync(entry);
                  }}
                  theme={theme}
                />
              ) : null}
              {!entry.builtIn ? (
                <UiButton
                  label={t("library.details.deleteEverywhere")}
                  onPress={() => {
                    onClose();
                    onDelete(entry);
                  }}
                  textTone="danger"
                  theme={theme}
                  variant="ghost"
                />
              ) : null}
            </View>
          </ScrollView>
        </UiModalSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: uiSpace.sm + uiSpace.hairline,
    marginTop: uiSpace.xl,
  },
  author: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.35,
    lineHeight: 31,
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 18,
    width: 82,
  },
  detailRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: uiSpace.md,
    minHeight: 48,
    paddingHorizontal: uiRadius.card,
    paddingVertical: 13,
  },
  details: {
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: uiSpace.xl,
    overflow: "hidden",
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "right",
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
});
