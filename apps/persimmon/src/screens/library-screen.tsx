import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import {
  showBookMenu,
  type BookMenuAction,
  type BookMenuRect,
} from "../../modules/persimmon-selection-menu";
import { UiButton } from "../components/ui-button";
import { UiIcon } from "../components/ui-icon";
import { uiBackdropColor } from "../components/ui-shadow";
import { UiEmptyState, UiInlineAlert } from "../components/ui-state-message";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";
import {
  loadSyncBannerVisible,
  saveSyncBannerVisible,
} from "../library/library-ui-preferences";
import {
  readingStatusForEntry,
  searchLibraryEntries,
  selectLibraryEntries,
  type LibraryFilter,
  type LibrarySort,
} from "../library/library-view";
import type { LibraryBookSummary } from "../library/repository";
import type { ReaderColorMode } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";
import { BookDetailsModal } from "./book-details-modal";
import { LibraryBookCard } from "./library-book-card";
import { LibrarySearchModal } from "./library-search-modal";
import {
  LibrarySettingsModal,
  syncDescription,
} from "./library-settings-modal";

const FILTER_OPTIONS: readonly {
  readonly value: LibraryFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "reading", label: "在读" },
  { value: "unread", label: "未读" },
  { value: "finished", label: "读完" },
];

const SORT_OPTIONS: readonly {
  readonly value: LibrarySort;
  readonly label: string;
}[] = [
  { value: "recent", label: "最近阅读" },
  { value: "added", label: "加入时间" },
  { value: "title", label: "书名" },
];

function labelForSort(sort: LibrarySort): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "排序";
}

function FilterOption({
  label,
  selected,
  theme,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly theme: ReaderTheme;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.filterOption,
        selected && { backgroundColor: theme.panelRaised },
      ]}
    >
      <Text
        style={[
          styles.filterOptionText,
          {
            color: selected ? theme.text : theme.secondaryText,
            fontWeight: selected ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SortControl({
  sort,
  theme,
  onChange,
}: {
  readonly sort: LibrarySort;
  readonly theme: ReaderTheme;
  readonly onChange: (sort: LibrarySort) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <UiButton
        accessibilityLabel={`排序，当前${labelForSort(sort)}`}
        accessibilityState={{ expanded: visible }}
        compact
        label={labelForSort(sort)}
        leadingIcon="sort"
        onPress={() => setVisible(true)}
        textTone="muted"
        theme={theme}
        trailingIcon="chevronDown"
        variant="ghost"
      />
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View
          style={[
            styles.sortBackdrop,
            { backgroundColor: uiBackdropColor(theme, "soft") },
          ]}
        >
          <Pressable
            accessibilityLabel="关闭排序"
            accessibilityRole="button"
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.sortMenu,
              {
                backgroundColor: theme.panel,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Text style={[styles.sortTitle, { color: theme.text }]}>
              排序方式
            </Text>
            {SORT_OPTIONS.map((option) => {
              const selected = option.value === sort;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.sortOption,
                    pressed && { backgroundColor: theme.panelMuted },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      {
                        color: selected ? theme.accentStrong : theme.text,
                        fontWeight: selected ? "700" : "500",
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <View style={styles.sortCheck}>
                    {selected ? (
                      <UiIcon
                        color={theme.accentStrong}
                        name="check"
                        size={17}
                        weight="semibold"
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

function SyncBanner({
  status,
  theme,
  onClose,
  onOpenSettings,
}: {
  readonly status: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onClose: () => void;
  readonly onOpenSettings: () => void;
}) {
  if (status.phase === "unconfigured") {
    return null;
  }
  const needsAttention =
    status.phase === "disconnected" ||
    status.phase === "reauthorization-required" ||
    status.phase === "error";

  return (
    <View
      style={[
        styles.syncBanner,
        {
          backgroundColor: theme.panel,
          borderColor: needsAttention ? theme.noteAccent : theme.border,
        },
      ]}
    >
      <Pressable
        accessibilityLabel="打开云同步设置"
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={styles.syncBannerMain}
      >
        <UiIcon
          color={theme.accentStrong}
          name="cloud"
          size={20}
          style={styles.syncBannerIcon}
        />
        <View style={styles.syncBannerCopy}>
          <Text style={[styles.syncBannerTitle, { color: theme.text }]}>
            {needsAttention ? "设置云同步" : "Google Drive"}
          </Text>
          <Text
            numberOfLines={2}
            style={[
              styles.syncBannerDescription,
              { color: theme.secondaryText },
            ]}
          >
            {syncDescription(status)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel="关闭云同步提示"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onClose}
        style={styles.syncBannerClose}
      >
        <UiIcon color={theme.secondaryText} name="close" size={17} />
      </Pressable>
    </View>
  );
}

export interface LibraryScreenProps {
  readonly entries: readonly LibraryBookSummary[];
  readonly colorMode: ReaderColorMode;
  readonly error: string | null;
  readonly importing: boolean;
  readonly openingBookId: string | null;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onConnectGoogleDrive: () => void;
  readonly onColorModeChange: (colorMode: ReaderColorMode) => void;
  readonly onDelete: (entry: LibraryBookSummary) => void;
  readonly onDisconnectGoogleDrive: () => void;
  readonly onDismissError: () => void;
  readonly onImport: () => void;
  readonly onOpen: (bookId: string) => void;
  readonly onSyncBook: (entry: LibraryBookSummary) => void;
  readonly onSyncNow: () => void;
}

export function LibraryScreen({
  entries,
  colorMode,
  error,
  importing,
  openingBookId,
  syncStatus,
  theme,
  onConnectGoogleDrive,
  onColorModeChange,
  onDelete,
  onDisconnectGoogleDrive,
  onDismissError,
  onImport,
  onOpen,
  onSyncBook,
  onSyncNow,
}: LibraryScreenProps) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 720;
  const horizontalPadding = compact ? 18 : 30;
  const gridGap = compact ? 13 : 25;
  const availableWidth = Math.min(1200, windowWidth - horizontalPadding * 2);
  const columnCount = compact
    ? availableWidth >= 270
      ? 3
      : 2
    : Math.max(
        4,
        Math.min(6, Math.floor((availableWidth + gridGap) / (150 + gridGap))),
      );
  const cardWidth = Math.floor(
    (availableWidth - gridGap * (columnCount - 1)) / columnCount,
  );

  const [detailsEntry, setDetailsEntry] = useState<LibraryBookSummary>();
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [syncBannerVisible, setSyncBannerVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadSyncBannerVisible().then((visible) => {
      if (!cancelled) {
        setSyncBannerVisible(visible);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEntries = useMemo(
    () => selectLibraryEntries(entries, filter, sort),
    [entries, filter, sort],
  );
  const searchResults = useMemo(
    () => searchLibraryEntries(entries, searchQuery),
    [entries, searchQuery],
  );
  const counts = useMemo(
    () => ({
      all: entries.length,
      reading: entries.filter(
        (entry) => readingStatusForEntry(entry) === "reading",
      ).length,
      unread: entries.filter(
        (entry) => readingStatusForEntry(entry) === "unread",
      ).length,
      finished: entries.filter(
        (entry) => readingStatusForEntry(entry) === "finished",
      ).length,
    }),
    [entries],
  );

  const updateSyncBannerVisible = (visible: boolean) => {
    setSyncBannerVisible(visible);
    void saveSyncBannerVisible(visible);
  };

  const syncBook = (entry: LibraryBookSummary) => {
    if (
      syncStatus.phase === "disconnected" ||
      syncStatus.phase === "unconfigured" ||
      syncStatus.phase === "reauthorization-required"
    ) {
      setSettingsVisible(true);
      return;
    }
    onSyncBook(entry);
  };

  const openBookMenu = async (
    entry: LibraryBookSummary,
    rect: BookMenuRect,
  ) => {
    if (Platform.OS === "web") {
      setDetailsEntry(entry);
      return;
    }
    let action: BookMenuAction | undefined;
    try {
      action = await showBookMenu(
        entry.status === "ready" ? "立即同步" : "从云端下载",
        !entry.builtIn,
        rect,
      );
    } catch {
      setDetailsEntry(entry);
      return;
    }
    switch (action) {
      case "sync":
        syncBook(entry);
        break;
      case "delete":
        onDelete(entry);
        break;
      case "details":
        setDetailsEntry(entry);
        break;
      case undefined:
        break;
    }
  };

  const openFromSearch = (bookId: string) => {
    setSearchVisible(false);
    setSearchQuery("");
    onOpen(bookId);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.surrounding }]}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={
          theme.colorScheme === "dark" ? "light-content" : "dark-content"
        }
        translucent
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: 1200 + horizontalPadding * 2,
            paddingHorizontal: horizontalPadding,
          },
          compact && styles.contentCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="display" style={{ color: theme.text }}>
            全部
          </Text>
          <View style={styles.headerActions}>
            <UiButton
              accessibilityLabel="搜索书名或作者"
              iconOnly
              label="搜索"
              leadingIcon="search"
              onPress={() => setSearchVisible(true)}
              theme={theme}
            />
            <UiButton
              accessibilityLabel="打开设置"
              iconOnly
              label="设置"
              leadingIcon="settings"
              onPress={() => setSettingsVisible(true)}
              theme={theme}
            />
            <UiButton
              accessibilityLabel="导入 EPUB"
              disabled={importing}
              iconOnly
              label="导入 EPUB"
              leadingIcon="add"
              loading={importing}
              onPress={onImport}
              theme={theme}
              variant="primary"
            />
          </View>
        </View>

        {error ? (
          <UiInlineAlert
            actionLabel="关闭"
            message={error}
            theme={theme}
            onAction={onDismissError}
          />
        ) : null}

        {syncBannerVisible ? (
          <SyncBanner
            status={syncStatus}
            theme={theme}
            onClose={() => updateSyncBannerVisible(false)}
            onOpenSettings={() => setSettingsVisible(true)}
          />
        ) : null}

        <View style={styles.controls}>
          <ScrollView
            contentContainerStyle={[
              styles.filterGroup,
              { backgroundColor: theme.panelMuted },
            ]}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {FILTER_OPTIONS.map((option) => (
              <FilterOption
                key={option.value}
                label={`${option.label} ${counts[option.value]}`}
                selected={filter === option.value}
                theme={theme}
                onPress={() => setFilter(option.value)}
              />
            ))}
          </ScrollView>
          <SortControl sort={sort} theme={theme} onChange={setSort} />
        </View>

        <View style={[styles.grid, { columnGap: gridGap, rowGap: 30 }]}>
          {visibleEntries.map((entry) => (
            <LibraryBookCard
              entry={entry}
              key={entry.id}
              opening={openingBookId === entry.id}
              theme={theme}
              width={cardWidth}
              onContextMenu={(selectedEntry, rect) => {
                void openBookMenu(selectedEntry, rect);
              }}
              onOpen={() => onOpen(entry.id)}
            />
          ))}
        </View>

        {visibleEntries.length === 0 ? (
          <UiEmptyState
            body="换一个分类，或导入一本 EPUB。"
            theme={theme}
            title="这里还没有书"
          />
        ) : null}
      </ScrollView>

      <LibrarySearchModal
        entries={searchResults}
        query={searchQuery}
        theme={theme}
        visible={searchVisible}
        onClose={() => {
          setSearchVisible(false);
          setSearchQuery("");
        }}
        onOpen={openFromSearch}
        onQueryChange={setSearchQuery}
      />
      <LibrarySettingsModal
        colorMode={colorMode}
        syncBannerVisible={syncBannerVisible}
        syncStatus={syncStatus}
        theme={theme}
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onColorModeChange={onColorModeChange}
        onConnectGoogleDrive={onConnectGoogleDrive}
        onDisconnectGoogleDrive={onDisconnectGoogleDrive}
        onSyncBannerVisibleChange={updateSyncBannerVisible}
        onSyncNow={onSyncNow}
      />
      <BookDetailsModal
        entry={detailsEntry}
        theme={theme}
        onClose={() => setDetailsEntry(undefined)}
        onDelete={onDelete}
        onOpen={onOpen}
        onSync={syncBook}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    paddingBottom: 64,
    paddingTop: Platform.OS === "web" ? 44 : 60,
    width: "100%",
  },
  contentCompact: {
    paddingBottom: 42,
    paddingTop: Platform.OS === "web" ? 30 : 50,
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.md,
    justifyContent: "space-between",
    marginBottom: 25,
  },
  filterGroup: {
    borderRadius: uiRadius.pill,
    flexGrow: 0,
    padding: 3,
  },
  filterOption: {
    alignItems: "center",
    borderRadius: uiRadius.pill,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  filterOptionText: {
    fontSize: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    minHeight: 40,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.sm,
  },
  screen: {
    flex: 1,
  },
  sortBackdrop: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  sortCheck: {
    alignItems: "center",
    justifyContent: "center",
    width: 20,
  },
  sortMenu: {
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 330,
    padding: 9,
    width: "100%",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 20px 60px rgba(0, 0, 0, 0.24)" }
      : {
          elevation: 12,
          shadowOffset: { width: 0, height: 15 },
          shadowOpacity: 0.24,
          shadowRadius: 28,
        }),
  },
  sortOption: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 13,
  },
  sortOptionText: {
    fontSize: 15,
  },
  sortTitle: {
    fontSize: 16,
    fontWeight: "700",
    paddingBottom: 7,
    paddingHorizontal: 13,
    paddingTop: 8,
  },
  syncBanner: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    marginBottom: 20,
    minHeight: 68,
  },
  syncBannerClose: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    width: 44,
  },
  syncBannerCopy: {
    flex: 1,
  },
  syncBannerDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  syncBannerIcon: {
    marginRight: 12,
  },
  syncBannerMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    minHeight: 68,
    paddingLeft: 15,
    paddingVertical: 10,
  },
  syncBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
});
