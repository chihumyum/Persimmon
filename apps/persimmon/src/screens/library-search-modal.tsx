import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { LibraryNativeEmptyState } from "../components/library-native-empty-state";
import { LibraryNativeSearchField } from "../components/library-native-search-field";
import { LibraryNativeSearchResultsSurface } from "../components/library-native-search-results-surface";
import { LibraryNativeSheet } from "../components/library-native-sheet";
import { LibraryNativeActionRow } from "../components/library-native-settings-row";
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

  return (
    <LibraryNativeSheet
      closeAccessibilityLabel={t("common.close")}
      heightRatio={0.68}
      theme={theme}
      title={t("common.search")}
      visible={visible}
      onClose={onClose}
    >
      <View style={styles.content}>
        <LibraryNativeSearchField
          clearAccessibilityLabel={t("library.search.clearAccessibility")}
          placeholder={t("library.search.placeholder")}
          query={query}
          theme={theme}
          onQueryChange={onQueryChange}
        />
        {query && entries.length === 0 ? (
          <LibraryNativeEmptyState
            body={t("library.search.emptyBody")}
            style={styles.empty}
            theme={theme}
            title={t("library.search.emptyTitle")}
          />
        ) : null}
        {query && entries.length > 0 ? (
          <View style={styles.resultsHost}>
            <LibraryNativeSearchResultsSurface theme={theme}>
              {entries.map((entry) => (
                <LibraryNativeActionRow
                  accessibilityLabel={t("library.search.openAccessibility", {
                    title: entry.title,
                  })}
                  description={entry.author ?? t("common.unknownAuthor")}
                  key={entry.id}
                  showsChevron
                  theme={theme}
                  title={entry.title}
                  onPress={() => onOpen(entry.id)}
                />
              ))}
            </LibraryNativeSearchResultsSurface>
          </View>
        ) : null}
      </View>
    </LibraryNativeSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  empty: { flex: 1 },
  resultsHost: { flex: 1, width: "100%" },
});
