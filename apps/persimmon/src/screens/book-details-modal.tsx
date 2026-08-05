import { FieldGroup, Host } from "@expo/ui";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { LibraryNativeSheet } from "../components/library-native-sheet";
import { LibraryNativeActionRow } from "../components/library-native-settings-row";
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
  const [displayEntry, setDisplayEntry] = useState(entry);

  useEffect(() => {
    if (entry) setDisplayEntry(entry);
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
      <Host
        colorScheme={theme.colorScheme}
        seedColor={theme.accent}
        style={styles.host}
        useViewportSizeMeasurement
      >
        <FieldGroup
          style={{
            backgroundColor: theme.panel,
          }}
        >
          <FieldGroup.Section>
            <LibraryNativeActionRow
              description={displayEntry.author ?? t("common.unknownAuthor")}
              theme={theme}
              title={displayEntry.title}
            />
          </FieldGroup.Section>

          <FieldGroup.Section>
            <LibraryNativeActionRow
              theme={theme}
              title={t("library.details.progress")}
              value={
                displayEntry.locator
                  ? formatPercentage(readingProgressPercent(displayEntry))
                  : t("library.details.notStarted")
              }
            />
            <LibraryNativeActionRow
              theme={theme}
              title={t("library.details.localStatus")}
              value={
                displayEntry.status === "ready"
                  ? t("library.details.downloaded")
                  : t("library.details.needsDownload")
              }
            />
            <LibraryNativeActionRow
              theme={theme}
              title={t("library.details.file")}
              value={
                displayEntry.sourceName === "旧版导入" ||
                displayEntry.sourceName === "Legacy import"
                  ? t("library.details.legacyImport")
                  : displayEntry.sourceName
              }
            />
            <LibraryNativeActionRow
              theme={theme}
              title={t("library.details.size")}
              value={
                displayEntry.builtIn
                  ? t("library.details.builtIn")
                  : formatByteCount(displayEntry.originalByteLength)
              }
            />
            <LibraryNativeActionRow
              theme={theme}
              title={t("library.details.added")}
              value={dateLabel(displayEntry.addedAt)}
            />
          </FieldGroup.Section>

          <FieldGroup.Section>
            {displayEntry.status === "ready" ? (
              <LibraryNativeActionRow
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
              <LibraryNativeActionRow
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
            {!displayEntry.builtIn ? (
              <LibraryNativeActionRow
                theme={theme}
                title={t("library.details.deleteEverywhere")}
                tone="danger"
                onPress={() => {
                  onClose();
                  onDelete(displayEntry);
                }}
              />
            ) : null}
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </LibraryNativeSheet>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, width: "100%" },
});
