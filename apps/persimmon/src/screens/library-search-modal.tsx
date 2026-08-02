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
import { useTranslation } from "react-i18next";

import { UiIcon } from "../components/ui-icon";
import { uiBackdropColor } from "../components/ui-shadow";
import { UiEmptyState } from "../components/ui-state-message";
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
  const { t } = useTranslation();
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
            backgroundColor: uiBackdropColor(theme, "soft"),
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
              <UiIcon
                color={theme.secondaryText}
                name="search"
                size={18}
                style={styles.searchIcon}
              />
              <TextInput
                accessibilityLabel={t("library.search.placeholder")}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={onQueryChange}
                placeholder={t("library.search.placeholder")}
                placeholderTextColor={theme.secondaryText}
                selectionColor={theme.accent}
                style={[styles.input, { color: theme.text }]}
                value={query}
              />
              {query ? (
                <Pressable
                  accessibilityLabel={t("library.search.clearAccessibility")}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => onQueryChange("")}
                  style={styles.clearButton}
                >
                  <UiIcon color={theme.secondaryText} name="close" size={15} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelText, { color: theme.accentStrong }]}>
                {t("common.cancel")}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {query && entries.length === 0 ? (
              <UiEmptyState
                body={t("library.search.emptyBody")}
                style={styles.empty}
                theme={theme}
                title={t("library.search.emptyTitle")}
              />
            ) : null}
            {query
              ? entries.map((entry) => (
                  <Pressable
                    accessibilityLabel={t("library.search.openAccessibility", {
                      title: entry.title,
                    })}
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
                        {entry.author ?? t("common.unknownAuthor")}
                      </Text>
                    </View>
                    <UiIcon
                      color={theme.secondaryText}
                      name="chevronRight"
                      size={17}
                    />
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
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 42,
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
    marginRight: 5,
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
});
