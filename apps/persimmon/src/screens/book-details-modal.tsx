import type { ReaderTheme } from "@persimmon/reader-skia";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UiButton } from "../components/ui-button";
import { UiModalSurface } from "../components/ui-modal-surface";
import { uiBackdropColor } from "../components/ui-shadow";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";
import { readingProgressPercent } from "../library/library-view";
import type { LibraryBookSummary } from "../library/repository";

function byteCountLabel(byteLength: number): string {
  if (byteLength < 1024) {
    return `${byteLength} B`;
  }
  if (byteLength < 1024 * 1024) {
    return `${(byteLength / 1024).toFixed(1)} KB`;
  }
  return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString([], {
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
          accessibilityLabel="关闭书籍详情"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <UiModalSurface theme={theme}>
          <View style={styles.header}>
            <Text variant="panelTitle" style={{ color: theme.text }}>
              书籍详情
            </Text>
            <UiButton
              compact
              label="完成"
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
              {entry.author ?? "未知作者"}
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
                label="阅读进度"
                theme={theme}
                value={
                  entry.locator
                    ? `${readingProgressPercent(entry)}%`
                    : "尚未开始"
                }
              />
              <DetailRow
                label="本机状态"
                theme={theme}
                value={
                  entry.status === "ready" ? "已下载" : "需要从云端重新下载"
                }
              />
              <DetailRow label="文件" theme={theme} value={entry.sourceName} />
              <DetailRow
                label="大小"
                theme={theme}
                value={
                  entry.builtIn
                    ? "内置内容"
                    : byteCountLabel(entry.originalByteLength)
                }
              />
              <DetailRow
                label="加入书架"
                theme={theme}
                value={dateLabel(entry.addedAt)}
              />
            </View>

            <View style={styles.actions}>
              {entry.status === "ready" ? (
                <UiButton
                  label="继续阅读"
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
                  label={entry.status === "ready" ? "立即同步" : "从云端下载"}
                  onPress={() => {
                    onClose();
                    onSync(entry);
                  }}
                  theme={theme}
                />
              ) : null}
              {!entry.builtIn ? (
                <UiButton
                  label="从书架和云端删除"
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
