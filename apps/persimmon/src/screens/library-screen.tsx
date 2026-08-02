import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

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
import type { AppLanguagePreference } from "../i18n";
import {
  dismissGoogleDrivePrompt,
  loadBookMetadataVisible,
  loadGoogleDrivePromptDismissed,
  saveBookMetadataVisible,
} from "../library/library-ui-preferences";
import { shouldUseIconOnlySort } from "../library/library-controls-layout";
import {
  librarySyncBannerPlacement,
  shouldAnnounceSyncCompletion,
  SYNC_COMPLETION_VISIBLE_MS,
} from "../library/library-sync-banner";
import {
  arrangeLibraryGridEntries,
  readingStatusForEntry,
  searchLibraryEntries,
  type LibraryFilter,
  type LibrarySort,
} from "../library/library-view";
import type { LibraryBookSummary } from "../library/repository";
import type { ReaderColorMode, ReaderThemeName } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";
import { BookDetailsModal } from "./book-details-modal";
import { LibraryBookCard } from "./library-book-card";
import { LibrarySearchModal } from "./library-search-modal";
import {
  LibrarySettingsModal,
  syncDescription,
} from "./library-settings-modal";

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
  iconOnly,
  sort,
  theme,
  onChange,
  onExpandedWidthChange,
}: {
  readonly iconOnly: boolean;
  readonly sort: LibrarySort;
  readonly theme: ReaderTheme;
  readonly onChange: (sort: LibrarySort) => void;
  readonly onExpandedWidthChange: (width: number) => void;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const sortOptions: readonly {
    readonly value: LibrarySort;
    readonly label: string;
  }[] = [
    { value: "recent", label: t("library.sort.recent") },
    { value: "added", label: t("library.sort.added") },
    { value: "title", label: t("library.sort.title") },
  ];
  const label =
    sortOptions.find((option) => option.value === sort)?.label ??
    t("library.sort.default");

  return (
    <>
      <View style={styles.sortControl}>
        <UiButton
          accessibilityLabel={t("library.sort.currentAccessibility", {
            label,
          })}
          accessibilityState={{ expanded: visible }}
          compact
          iconOnly={iconOnly}
          label={label}
          leadingIcon="sort"
          onPress={() => setVisible(true)}
          textTone="muted"
          theme={theme}
          trailingIcon={iconOnly ? undefined : "chevronDown"}
          variant="ghost"
        />
      </View>
      {/* Keep intrinsic measurement outside the icon-only wrapper. Otherwise
          Yoga constrains this copy to the compact width and creates a
          full-button/icon-only layout feedback loop. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        key={label}
        onLayout={(event) =>
          onExpandedWidthChange(event.nativeEvent.layout.width)
        }
        pointerEvents="none"
        style={styles.sortControlMeasurement}
      >
        <UiButton
          compact
          label={label}
          leadingIcon="sort"
          onPress={() => undefined}
          textTone="muted"
          theme={theme}
          trailingIcon="chevronDown"
          variant="ghost"
        />
      </View>
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
            accessibilityLabel={t("library.sort.closeAccessibility")}
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
              {t("library.sort.heading")}
            </Text>
            {sortOptions.map((option) => {
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
  floating = false,
  status,
  theme,
  onClose,
  onOpenSettings,
}: {
  readonly floating?: boolean;
  readonly status: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onClose?: () => void;
  readonly onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  if (status.phase === "unconfigured") {
    return null;
  }
  const needsAttention =
    status.phase === "disconnected" ||
    status.phase === "reauthorization-required" ||
    status.phase === "error";
  const title =
    status.phase === "idle"
      ? t("sync.banner.complete")
      : needsAttention
        ? t("sync.banner.setup")
        : status.phase === "syncing"
          ? t("sync.banner.syncing")
          : "Google Drive";

  return (
    <View
      style={[
        styles.syncBanner,
        {
          backgroundColor: theme.panel,
          borderColor: needsAttention ? theme.noteAccent : theme.border,
          ...(floating && Platform.OS !== "web"
            ? { shadowColor: theme.shadow }
            : {}),
        },
        floating && styles.syncBannerFloating,
      ]}
    >
      <Pressable
        accessibilityLabel={t("sync.banner.openSettingsAccessibility")}
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={styles.syncBannerMain}
      >
        {status.phase === "syncing" ? (
          <ActivityIndicator
            accessibilityLabel={t("sync.banner.syncingAccessibility")}
            color={theme.accentStrong}
            size="small"
            style={styles.syncBannerIcon}
          />
        ) : (
          <UiIcon
            color={theme.accentStrong}
            name="cloud"
            size={20}
            style={styles.syncBannerIcon}
          />
        )}
        <View style={styles.syncBannerCopy}>
          <Text style={[styles.syncBannerTitle, { color: theme.text }]}>
            {title}
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
      {status.phase !== "syncing" && onClose ? (
        <Pressable
          accessibilityLabel={t("sync.banner.closeAccessibility")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={styles.syncBannerClose}
        >
          <UiIcon color={theme.secondaryText} name="close" size={17} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FloatingSyncBanner({
  bottom,
  horizontalPadding,
  status,
  theme,
  visible,
  onClose,
  onOpenSettings,
}: {
  readonly bottom: number;
  readonly horizontalPadding: number;
  readonly status: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onClose?: () => void;
  readonly onOpenSettings: () => void;
}) {
  const transition = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(visible);
  const [mounted, setMounted] = useState(visible);
  const [displayStatus, setDisplayStatus] = useState(status);

  useEffect(() => {
    if (visible) {
      setDisplayStatus(status);
    }
  }, [status, visible]);

  useEffect(() => {
    let frame = 0;
    transition.stopAnimation();
    if (visible) {
      const entering = !mountedRef.current;
      mountedRef.current = true;
      setMounted(true);
      if (entering) {
        transition.setValue(0);
      }
      frame = requestAnimationFrame(() => {
        Animated.timing(transition, {
          duration: 240,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }).start();
      });
    } else if (mountedRef.current) {
      Animated.timing(transition, {
        duration: 180,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          mountedRef.current = false;
          setMounted(false);
        }
      });
    }
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      transition.stopAnimation();
    };
  }, [transition, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.syncBannerFloatingLayer,
        {
          bottom,
          opacity: transition,
          paddingHorizontal: horizontalPadding,
          transform: [
            {
              translateY: transition.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.syncBannerFloatingWidth}>
        <SyncBanner
          floating
          status={displayStatus}
          theme={theme}
          onClose={onClose}
          onOpenSettings={onOpenSettings}
        />
      </View>
    </Animated.View>
  );
}

export interface LibraryScreenProps {
  readonly entries: readonly LibraryBookSummary[];
  readonly colorMode: ReaderColorMode;
  readonly readerThemeName: ReaderThemeName;
  readonly error: string | null;
  readonly importing: boolean;
  readonly languagePreference: AppLanguagePreference;
  readonly openingBookId: string | null;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onConnectGoogleDrive: () => void;
  readonly onColorModeChange: (colorMode: ReaderColorMode) => void;
  readonly onDelete: (entry: LibraryBookSummary) => void;
  readonly onDisconnectGoogleDrive: () => void;
  readonly onDismissError: () => void;
  readonly onImport: () => void;
  readonly onLanguagePreferenceChange: (
    preference: AppLanguagePreference,
  ) => void;
  readonly onOpen: (bookId: string) => void;
  readonly onSyncBook: (entry: LibraryBookSummary) => void;
  readonly onSyncNow: () => void;
  readonly onThemeChange: (theme: ReaderThemeName) => void;
}

export function LibraryScreen({
  entries,
  colorMode,
  readerThemeName,
  error,
  importing,
  languagePreference,
  openingBookId,
  syncStatus,
  theme,
  onConnectGoogleDrive,
  onColorModeChange,
  onDelete,
  onDisconnectGoogleDrive,
  onDismissError,
  onImport,
  onLanguagePreferenceChange,
  onOpen,
  onSyncBook,
  onSyncNow,
  onThemeChange,
}: LibraryScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
  const [bookMetadataVisible, setBookMetadataVisible] = useState(true);
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [controlsWidth, setControlsWidth] = useState(0);
  const [filterContentWidth, setFilterContentWidth] = useState(0);
  const [expandedSortWidth, setExpandedSortWidth] = useState(0);
  const filterOptions: readonly {
    readonly value: LibraryFilter;
    readonly label: string;
  }[] = [
    { value: "all", label: t("library.filters.all") },
    { value: "reading", label: t("library.filters.reading") },
    { value: "unread", label: t("library.filters.unread") },
    { value: "finished", label: t("library.filters.finished") },
  ];
  const [connectionPromptDismissed, setConnectionPromptDismissed] = useState<
    boolean | undefined
  >(undefined);
  const [syncCompletionVisible, setSyncCompletionVisible] = useState(false);
  const [syncErrorDismissed, setSyncErrorDismissed] = useState(false);
  const previousSyncPhase = useRef<GoogleDriveSyncStatus["phase"]>(
    syncStatus.phase,
  );
  const enteringSyncCompletion = shouldAnnounceSyncCompletion(
    previousSyncPhase.current,
    syncStatus.phase,
  );
  const syncBannerPlacement = librarySyncBannerPlacement(syncStatus, {
    connectionPromptDismissed,
    syncCompletionVisible: syncCompletionVisible || enteringSyncCompletion,
  });
  const floatingSyncBannerVisible =
    syncBannerPlacement === "floating" &&
    !(syncStatus.phase === "error" && syncErrorDismissed);
  const sortIconOnly = shouldUseIconOnlySort({
    controlsWidth,
    expandedSortWidth,
    filterContentWidth,
    gap: uiSpace.md,
  });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadGoogleDrivePromptDismissed(),
      loadBookMetadataVisible(),
    ]).then(([promptDismissed, nextBookMetadataVisible]) => {
      if (!cancelled) {
        setConnectionPromptDismissed(promptDismissed);
        setBookMetadataVisible(nextBookMetadataVisible);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previousPhase = previousSyncPhase.current;
    previousSyncPhase.current = syncStatus.phase;

    if (!shouldAnnounceSyncCompletion(previousPhase, syncStatus.phase)) {
      if (syncStatus.phase === "syncing") {
        setSyncCompletionVisible(false);
        setSyncErrorDismissed(false);
      } else if (syncStatus.phase === "error") {
        setSyncCompletionVisible(false);
        setSyncErrorDismissed(false);
      }
      return;
    }

    setSyncCompletionVisible(true);
    const timer = setTimeout(() => {
      setSyncCompletionVisible(false);
    }, SYNC_COMPLETION_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [syncStatus]);

  const gridEntries = useMemo(
    () => arrangeLibraryGridEntries(entries, filter, sort),
    [entries, filter, sort],
  );
  const visibleEntries = useMemo(
    () =>
      gridEntries.filter(({ visible }) => visible).map(({ entry }) => entry),
    [gridEntries],
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

  const dismissConnectionPrompt = () => {
    setConnectionPromptDismissed(true);
    void dismissGoogleDrivePrompt();
  };

  const updateBookMetadataVisible = (visible: boolean) => {
    setBookMetadataVisible(visible);
    void saveBookMetadataVisible(visible);
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
        t("library.nativeMenu.details"),
        entry.status === "ready"
          ? t("library.actions.syncNow")
          : t("library.actions.downloadFromCloud"),
        t("library.nativeMenu.delete"),
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
          floatingSyncBannerVisible && styles.contentWithFloatingSyncBanner,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="display" style={{ color: theme.text }}>
            {t("library.title")}
          </Text>
          <View style={styles.headerActions}>
            <UiButton
              accessibilityLabel={t("library.actions.searchAccessibility")}
              iconOnly
              label={t("common.search")}
              leadingIcon="search"
              onPress={() => setSearchVisible(true)}
              theme={theme}
            />
            <UiButton
              accessibilityLabel={t(
                "library.actions.openSettingsAccessibility",
              )}
              iconOnly
              label={t("common.settings")}
              leadingIcon="settings"
              onPress={() => setSettingsVisible(true)}
              theme={theme}
            />
            <UiButton
              accessibilityLabel={t("library.actions.importAccessibility")}
              disabled={importing}
              iconOnly
              label={t("library.actions.importLabel")}
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
            actionLabel={t("library.actions.closeError")}
            message={error}
            theme={theme}
            onAction={onDismissError}
          />
        ) : null}

        {syncBannerPlacement === "top" ? (
          <SyncBanner
            status={syncStatus}
            theme={theme}
            onClose={dismissConnectionPrompt}
            onOpenSettings={() => setSettingsVisible(true)}
          />
        ) : null}

        <View
          onLayout={(event) => setControlsWidth(event.nativeEvent.layout.width)}
          style={styles.controls}
        >
          <ScrollView
            contentContainerStyle={[
              styles.filterGroup,
              { backgroundColor: theme.panelMuted },
            ]}
            horizontal
            onContentSizeChange={(width) => setFilterContentWidth(width)}
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroller}
          >
            {filterOptions.map((option) => (
              <FilterOption
                key={option.value}
                label={t("library.filters.withCount", {
                  label: option.label,
                  count: counts[option.value],
                })}
                selected={filter === option.value}
                theme={theme}
                onPress={() => setFilter(option.value)}
              />
            ))}
          </ScrollView>
          <SortControl
            iconOnly={sortIconOnly}
            sort={sort}
            theme={theme}
            onChange={setSort}
            onExpandedWidthChange={setExpandedSortWidth}
          />
        </View>

        <View style={[styles.grid, { columnGap: gridGap, rowGap: 30 }]}>
          {gridEntries.map(({ entry, visible }) => {
            return (
              <View
                key={entry.id}
                style={[
                  { width: cardWidth },
                  !visible && styles.hiddenGridEntry,
                ]}
              >
                <LibraryBookCard
                  bookMetadataVisible={bookMetadataVisible}
                  entry={entry}
                  opening={openingBookId === entry.id}
                  theme={theme}
                  width={cardWidth}
                  onContextMenu={(selectedEntry, rect) => {
                    void openBookMenu(selectedEntry, rect);
                  }}
                  onOpen={() => onOpen(entry.id)}
                />
              </View>
            );
          })}
        </View>

        {visibleEntries.length === 0 ? (
          <UiEmptyState
            body={t("library.empty.body")}
            theme={theme}
            title={t("library.empty.title")}
          />
        ) : null}
      </ScrollView>

      <FloatingSyncBanner
        bottom={Math.max(insets.bottom, uiSpace.md)}
        horizontalPadding={horizontalPadding}
        status={syncStatus}
        theme={theme}
        visible={floatingSyncBannerVisible}
        onClose={
          syncStatus.phase === "error"
            ? () => setSyncErrorDismissed(true)
            : undefined
        }
        onOpenSettings={() => setSettingsVisible(true)}
      />

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
        bookMetadataVisible={bookMetadataVisible}
        colorMode={colorMode}
        languagePreference={languagePreference}
        readerThemeName={readerThemeName}
        syncStatus={syncStatus}
        theme={theme}
        visible={settingsVisible}
        onBookMetadataVisibleChange={updateBookMetadataVisible}
        onClose={() => setSettingsVisible(false)}
        onColorModeChange={onColorModeChange}
        onConnectGoogleDrive={onConnectGoogleDrive}
        onDisconnectGoogleDrive={onDisconnectGoogleDrive}
        onLanguagePreferenceChange={onLanguagePreferenceChange}
        onSyncNow={onSyncNow}
        onThemeChange={onThemeChange}
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
  contentWithFloatingSyncBanner: {
    paddingBottom: 132,
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
  filterScroller: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
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
  hiddenGridEntry: {
    display: "none",
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
  sortControl: {
    flexShrink: 0,
    position: "relative",
  },
  sortControlMeasurement: {
    opacity: 0,
    position: "absolute",
    right: 0,
    top: 0,
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
  syncBannerFloating: {
    marginBottom: 0,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 12px 36px rgba(0, 0, 0, 0.18)" }
      : {
          elevation: 8,
          shadowOffset: { width: 0, height: 9 },
          shadowOpacity: 0.2,
          shadowRadius: 18,
        }),
  },
  syncBannerFloatingLayer: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  syncBannerFloatingWidth: {
    maxWidth: 560,
    width: "100%",
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
