import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UiText as Text } from "../components/ui-text";
import type { LibraryBookSummary } from "../library/repository";

export interface LibrarySearchModalProps {
  readonly entries: readonly LibraryBookSummary[];
  readonly query: string;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onOpen: (bookId: string) => void;
  readonly onQueryChange: (query: string) => void;
}

export function LibrarySearchModal({
  entries,
  query,
  theme,
  visible,
  onClose,
  onOpen,
  onQueryChange,
}: LibrarySearchModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
        style={[
          styles.backdrop,
          {
            paddingBottom: Math.max(insets.bottom, 14),
            paddingTop: Math.max(insets.top, 14),
          },
        ]}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.panel,
            {
              backgroundColor: theme.panel,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchField,
                { backgroundColor: theme.panelMuted },
              ]}
            >
              <Text
                accessibilityElementsHidden
                style={[styles.searchIcon, { color: theme.secondaryText }]}
              >
                ⌕
              </Text>
              <TextInput
                accessibilityLabel="搜索书名或作者"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={onQueryChange}
                placeholder="搜索书名或作者"
                placeholderTextColor={theme.secondaryText}
                selectionColor={theme.accent}
                style={[styles.input, { color: theme.text }]}
                value={query}
              />
              {query ? (
                <Pressable
                  accessibilityLabel="清空搜索"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => onQueryChange("")}
                  style={styles.clearButton}
                >
                  <Text
                    style={[styles.clearText, { color: theme.secondaryText }]}
                  >
                    ×
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelText, { color: theme.accentStrong }]}>
                取消
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {query && entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  没有匹配的书
                </Text>
                <Text
                  style={[styles.emptyBody, { color: theme.secondaryText }]}
                >
                  只搜索书名和作者。
                </Text>
              </View>
            ) : null}
            {query
              ? entries.map((entry) => (
                  <Pressable
                    accessibilityLabel={`打开 ${entry.title}`}
                    accessibilityRole="button"
                    key={entry.id}
                    onPress={() => onOpen(entry.id)}
                    style={({ pressed }) => [
                      styles.resultRow,
                      { borderBottomColor: theme.border },
                      pressed && { backgroundColor: theme.panelMuted },
                    ]}
                  >
                    <View style={styles.resultCopy}>
                      <Text
                        numberOfLines={1}
                        style={[styles.resultTitle, { color: theme.text }]}
                      >
                        {entry.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.resultAuthor,
                          { color: theme.secondaryText },
                        ]}
                      >
                        {entry.author ?? "未知作者"}
                      </Text>
                    </View>
                    <Text
                      accessibilityElementsHidden
                      style={[
                        styles.resultChevron,
                        { color: theme.secondaryText },
                      ]}
                    >
                      ›
                    </Text>
                  </Pressable>
                ))
              : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.24)",
    flex: 1,
    paddingHorizontal: 14,
  },
  cancelButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingLeft: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  clearButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  clearText: {
    fontSize: 22,
    lineHeight: 24,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 42,
  },
  emptyBody: {
    fontSize: 13,
    marginTop: 5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    paddingVertical: 0,
  },
  panel: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "72%",
    maxWidth: 700,
    overflow: "hidden",
    width: "100%",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 20px 60px rgba(0, 0, 0, 0.24)" }
      : {
          elevation: 12,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.24,
          shadowRadius: 28,
        }),
  },
  resultAuthor: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  resultChevron: {
    fontSize: 25,
    fontWeight: "300",
  },
  resultCopy: {
    flex: 1,
    paddingRight: 12,
  },
  resultRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  results: {
    flexGrow: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  searchField: {
    alignItems: "center",
    borderRadius: 13,
    flex: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 9,
  },
  searchIcon: {
    fontSize: 21,
    marginRight: 5,
    marginTop: -2,
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
});
