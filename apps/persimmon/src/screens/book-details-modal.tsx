import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UiText as Text } from "../components/ui-text";
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
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.panel,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              书籍详情
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.doneButton}
            >
              <Text style={[styles.doneText, { color: theme.accentStrong }]}>
                完成
              </Text>
            </Pressable>
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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onOpen(entry.id);
                  }}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: theme.panelRaised },
                    ]}
                  >
                    继续阅读
                  </Text>
                </Pressable>
              ) : null}
              {!entry.builtIn ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onSync(entry);
                  }}
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.panelRaised,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.controlText },
                    ]}
                  >
                    {entry.status === "ready" ? "立即同步" : "从云端下载"}
                  </Text>
                </Pressable>
              ) : null}
              {!entry.builtIn ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onDelete(entry);
                  }}
                  style={styles.deleteButton}
                >
                  <Text
                    style={[styles.deleteText, { color: theme.noteAccent }]}
                  >
                    从书架和云端删除
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 9,
    marginTop: 20,
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
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  deleteText: {
    fontSize: 13,
    fontWeight: "600",
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 18,
    width: 82,
  },
  detailRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  details: {
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
    overflow: "hidden",
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "right",
  },
  doneButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 3,
  },
  doneText: {
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalRoot: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  panel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "86%",
    maxWidth: 500,
    padding: 20,
    width: "100%",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 22px 70px rgba(0, 0, 0, 0.28)" }
      : {
          elevation: 14,
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.26,
          shadowRadius: 32,
        }),
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
