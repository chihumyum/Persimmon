import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
import { LibraryNativeEmptyState } from "../components/library-native-empty-state";
import { LibraryNativeFilterControl } from "../components/library-native-filter-control";
import { LibraryNativeSortControl } from "../components/library-native-sort-control";
import { LibraryNativeSyncNotice } from "../components/library-native-sync-notice";
import { LibraryNativeToolbarButton } from "../components/library-native-toolbar-button";
import { uiSpace } from "../components/ui-tokens";
import type { AppLanguagePreference } from "../i18n";
import {
  dismissGoogleDrivePrompt,
  loadBookMetadataVisible,
  loadGoogleDrivePromptDismissed,
  saveBookMetadataVisible,
} from "../library/library-ui-preferences";
import {
  librarySyncBannerPlacement,
  shouldAnnounceSyncCompletion,
  syncProgressFraction,
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
  const progress = status.phase === "syncing" ? status.progress : undefined;
  return (
    <LibraryNativeSyncNotice
      closeAccessibilityLabel={t("sync.banner.closeAccessibility")}
      description={syncDescription(status)}
      floating={floating}
      kind={
        status.phase === "syncing"
          ? "syncing"
          : status.phase === "idle"
            ? "success"
            : needsAttention
              ? "attention"
              : "cloud"
      }
      openAccessibilityLabel={t("sync.banner.openSettingsAccessibility")}
      progress={
        progress && progress.totalBooks > 0
          ? syncProgressFraction(progress)
          : undefined
      }
      theme={theme}
      title={title}
      onClose={status.phase === "syncing" ? undefined : onClose}
      onOpen={onOpenSettings}
    />
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
  readonly dataClearing: "local" | "cloud" | null;
  readonly readerThemeName: ReaderThemeName;
  readonly error: string | null;
  readonly importing: boolean;
  readonly languagePreference: AppLanguagePreference;
  readonly openingBookId: string | null;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onConnectGoogleDrive: () => void;
  readonly onClearCloudData: () => void;
  readonly onClearLocalData: () => void;
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
  dataClearing,
  readerThemeName,
  error,
  importing,
  languagePreference,
  openingBookId,
  syncStatus,
  theme,
  onConnectGoogleDrive,
  onClearCloudData,
  onClearLocalData,
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
  const filterOptions: readonly {
    readonly value: LibraryFilter;
    readonly label: string;
  }[] = [
    { value: "all", label: t("library.filters.all") },
    { value: "reading", label: t("library.filters.reading") },
    { value: "unread", label: t("library.filters.unread") },
    { value: "finished", label: t("library.filters.finished") },
  ];
  const sortOptions: readonly {
    readonly value: LibrarySort;
    readonly label: string;
  }[] = [
    { value: "recent", label: t("library.sort.recent") },
    { value: "added", label: t("library.sort.added") },
    { value: "title", label: t("library.sort.title") },
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
  const sortLabel =
    sortOptions.find((option) => option.value === sort)?.label ??
    t("library.sort.default");

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

  const handleBookMenuAction = (
    entry: LibraryBookSummary,
    action: BookMenuAction,
  ) => {
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
    }
  };

  const openBookMenu = async (
    entry: LibraryBookSummary,
    rect: BookMenuRect,
  ) => {
    let action: BookMenuAction | undefined;
    try {
      action = await showBookMenu(
        t("library.nativeMenu.details"),
        entry.status === "ready"
          ? t("library.actions.syncNow")
          : t("library.actions.downloadFromCloud"),
        t("library.nativeMenu.delete"),
        t("common.cancel"),
        !entry.builtIn,
        rect,
      );
    } catch {
      setDetailsEntry(entry);
      return;
    }
    if (action) {
      handleBookMenuAction(entry, action);
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t("library.title")}
          </Text>
          <View style={styles.headerActions}>
            <LibraryNativeToolbarButton
              accessibilityLabel={t("library.actions.searchAccessibility")}
              icon="search"
              onPress={() => setSearchVisible(true)}
              theme={theme}
            />
            <LibraryNativeToolbarButton
              accessibilityLabel={t(
                "library.actions.openSettingsAccessibility",
              )}
              icon="settings"
              onPress={() => setSettingsVisible(true)}
              theme={theme}
            />
            <LibraryNativeToolbarButton
              accessibilityLabel={t("library.actions.importAccessibility")}
              disabled={importing}
              icon="add"
              loading={importing}
              onPress={onImport}
              theme={theme}
              tintColor={importing ? theme.accentStrong : theme.controlText}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.noticeBlock}>
            <LibraryNativeSyncNotice
              closeAccessibilityLabel={t("library.actions.closeError")}
              description={error}
              kind="attention"
              openAccessibilityLabel={t("library.actions.closeError")}
              theme={theme}
              title={t("library.error.title")}
              onClose={onDismissError}
              onOpen={onDismissError}
            />
          </View>
        ) : null}

        {syncBannerPlacement === "top" ? (
          <View style={styles.noticeBlock}>
            <SyncBanner
              status={syncStatus}
              theme={theme}
              onClose={dismissConnectionPrompt}
              onOpenSettings={() => setSettingsVisible(true)}
            />
          </View>
        ) : null}

        <View style={styles.controls}>
          <LibraryNativeFilterControl
            accessibilityLabel={t("library.title")}
            options={filterOptions.map((option) => ({
              ...option,
              label: compact
                ? option.label
                : t("library.filters.withCount", {
                    label: option.label,
                    count: counts[option.value],
                  }),
            }))}
            theme={theme}
            value={filter}
            onChange={setFilter}
          />
          <LibraryNativeSortControl
            accessibilityLabel={t("library.sort.currentAccessibility", {
              label: sortLabel,
            })}
            iconOnly={compact}
            options={sortOptions}
            theme={theme}
            value={sort}
            onChange={setSort}
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
                  onMenuAction={handleBookMenuAction}
                  onOpen={() => onOpen(entry.id)}
                />
              </View>
            );
          })}
        </View>

        {visibleEntries.length === 0 ? (
          <LibraryNativeEmptyState
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
        dataActionsDisabled={importing || openingBookId !== null}
        dataClearing={dataClearing}
        languagePreference={languagePreference}
        readerThemeName={readerThemeName}
        syncStatus={syncStatus}
        theme={theme}
        visible={settingsVisible}
        onBookMetadataVisibleChange={updateBookMetadataVisible}
        onClearCloudData={onClearCloudData}
        onClearLocalData={onClearLocalData}
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
    paddingTop: 60,
    width: "100%",
  },
  contentCompact: {
    paddingBottom: 42,
    paddingTop: 50,
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
  headerTitle: {
    fontFamily: Platform.select({ android: "sans-serif", ios: "System" }),
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  hiddenGridEntry: {
    display: "none",
  },
  screen: {
    flex: 1,
  },
  noticeBlock: { marginBottom: 20 },
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
});
