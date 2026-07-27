import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  libraryRepository,
  type LibraryBookSummary,
} from "../library/repository";
import {
  readingProgressPercent,
  readingStatusForEntry,
  selectLibraryEntries,
  type LibraryFilter,
  type LibrarySort,
} from "../library/library-view";
import type { ReaderColorMode } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Of(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += BASE64_ALPHABET[first >> 2];
    output += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    output +=
      second === undefined
        ? "="
        : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? "=" : BASE64_ALPHABET[third & 0x3f];
  }
  return output;
}

function BookCover({
  entry,
  theme,
}: {
  readonly entry: LibraryBookSummary;
  readonly theme: ReaderTheme;
}) {
  const [uri, setUri] = useState<string>();

  useEffect(() => {
    if (!entry.coverAssetId || !entry.coverMediaType) {
      setUri(undefined);
      return;
    }
    let cancelled = false;
    void libraryRepository
      .getResource(entry.id, entry.coverAssetId)
      .then((bytes) => {
        if (!cancelled && bytes) {
          setUri(`data:${entry.coverMediaType};base64,${base64Of(bytes)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry.coverAssetId, entry.coverMediaType, entry.id]);

  if (uri) {
    return (
      <Image
        accessibilityLabel={`${entry.title} 封面`}
        resizeMode="cover"
        source={{ uri }}
        style={styles.coverImage}
      />
    );
  }
  return (
    <>
      <View style={[styles.coverFruit, { backgroundColor: theme.accent }]}>
        <Text style={[styles.coverFruitText, { color: theme.panelRaised }]}>
          柿
        </Text>
      </View>
      <Text
        numberOfLines={3}
        style={[styles.coverTitle, { color: theme.text }]}
      >
        {entry.title}
      </Text>
    </>
  );
}

interface BookCardProps {
  readonly entry: LibraryBookSummary;
  readonly opening: boolean;
  readonly theme: ReaderTheme;
  readonly width: number;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}

function BookCard({
  entry,
  opening,
  theme,
  width,
  onOpen,
  onDelete,
}: BookCardProps) {
  const status = readingStatusForEntry(entry);
  const progressPercent = readingProgressPercent(entry);
  const progressLabel =
    entry.status === "needs-reimport"
      ? "需要重新导入"
      : status === "finished"
        ? "已读 · 100%"
        : status === "reading"
          ? `在读 · ${progressPercent}%`
          : "未读 · 0%";

  return (
    <View style={[styles.bookCard, { width }]}>
      <Pressable
        accessibilityLabel={`打开 ${entry.title}`}
        accessibilityRole="button"
        disabled={opening || entry.status !== "ready"}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.bookCardPressable,
          pressed && styles.bookCardPressed,
        ]}
      >
        <View
          style={[
            styles.cover,
            {
              backgroundColor: theme.imagePlaceholder,
              ...(Platform.OS === "web" ? {} : { shadowColor: theme.shadow }),
            },
          ]}
        >
          {opening ? (
            <View style={styles.coverLoading}>
              <ActivityIndicator color={theme.accent} size="small" />
            </View>
          ) : (
            <BookCover entry={entry} theme={theme} />
          )}
        </View>
        <Text
          numberOfLines={1}
          style={[styles.bookTitle, { color: theme.text }]}
        >
          {entry.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.bookMeta, { color: theme.secondaryText }]}
        >
          {entry.author ?? entry.sourceName}
        </Text>
        <View
          style={[styles.progressTrack, { backgroundColor: theme.panelMuted }]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.accent,
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.bookProgress,
            { color: theme.accentStrong },
            entry.status === "needs-reimport" && {
              color: theme.noteAccent,
            },
          ]}
        >
          {progressLabel}
        </Text>
      </Pressable>
      {!entry.builtIn ? (
        <Pressable
          accessibilityLabel={`删除 ${entry.title}`}
          accessibilityRole="button"
          onPress={onDelete}
          style={styles.deleteButton}
        >
          <Text
            style={[styles.deleteButtonText, { color: theme.secondaryText }]}
          >
            删除
          </Text>
        </Pressable>
      ) : null}
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
  readonly onSyncNow: () => void;
}

function syncDescription(status: GoogleDriveSyncStatus): string {
  switch (status.phase) {
    case "loading":
      return "正在读取同步状态…";
    case "unconfigured":
      return status.message;
    case "disconnected":
      return "连接后将同步原始 EPUB 与稳定阅读位置，不会同步字号、布局或翻页样式。";
    case "authorizing":
      return "正在等待 Google 授权…";
    case "syncing":
      return status.accountEmail
        ? `正在与 ${status.accountEmail} 同步…`
        : "正在同步书本与阅读进度…";
    case "idle": {
      const time = new Date(status.lastSyncedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${status.accountEmail ?? "Google Drive"} · ${time} 已同步`;
    }
    case "reauthorization-required":
    case "error":
      return status.message;
  }
}

function GoogleDriveSyncCard({
  status,
  theme,
  onConnect,
  onDisconnect,
  onSync,
}: {
  readonly status: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
  readonly onSync: () => void;
}) {
  const busy = status.phase === "loading" || status.phase === "authorizing";
  const connected = status.phase === "idle" || status.phase === "error";
  const canConnect =
    status.phase === "disconnected" ||
    status.phase === "reauthorization-required";

  if (status.phase === "unconfigured") {
    return null;
  }

  return (
    <View
      style={[
        styles.syncCard,
        { backgroundColor: theme.panel, borderColor: theme.border },
      ]}
    >
      <View style={styles.syncCopy}>
        <Text style={[styles.syncTitle, { color: theme.text }]}>
          Google Drive 云同步
        </Text>
        <Text style={[styles.syncDescription, { color: theme.secondaryText }]}>
          {syncDescription(status)}
        </Text>
      </View>
      <View style={styles.syncActions}>
        {busy || status.phase === "syncing" ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : null}
        {canConnect ? (
          <Pressable
            accessibilityRole="button"
            onPress={onConnect}
            style={[
              styles.syncPrimaryButton,
              { backgroundColor: theme.accent },
            ]}
          >
            <Text
              style={[
                styles.syncPrimaryButtonText,
                { color: theme.panelRaised },
              ]}
            >
              {status.phase === "disconnected" ? "连接" : "重新连接"}
            </Text>
          </Pressable>
        ) : null}
        {status.phase === "idle" || status.phase === "error" ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSync}
            style={[styles.syncSecondaryButton, { borderColor: theme.border }]}
          >
            <Text
              style={[
                styles.syncSecondaryButtonText,
                { color: theme.accentStrong },
              ]}
            >
              立即同步
            </Text>
          </Pressable>
        ) : null}
        {connected ? (
          <Pressable
            accessibilityRole="button"
            onPress={onDisconnect}
            style={styles.syncDisconnectButton}
          >
            <Text
              style={[
                styles.syncDisconnectText,
                { color: theme.secondaryText },
              ]}
            >
              断开
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const COLOR_MODE_OPTIONS: readonly {
  readonly value: ReaderColorMode;
  readonly label: string;
}[] = [
  { value: "system", label: "自动" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

const FILTER_OPTIONS: readonly {
  readonly value: LibraryFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "reading", label: "在读" },
  { value: "unread", label: "未读" },
  { value: "finished", label: "已读" },
];

const SORT_OPTIONS: readonly {
  readonly value: LibrarySort;
  readonly label: string;
}[] = [
  { value: "recent", label: "最近阅读" },
  { value: "added", label: "导入时间" },
  { value: "title", label: "书名" },
];

function labelForSort(sort: LibrarySort): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "排序";
}

function SegmentedOption({
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
      onPress={onPress}
      style={[
        styles.segmentedOption,
        selected && {
          backgroundColor: theme.panelRaised,
          borderColor: theme.accent,
        },
      ]}
    >
      <Text
        style={[
          styles.segmentedOptionText,
          {
            color: selected ? theme.accentStrong : theme.secondaryText,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SortControl({
  compact,
  sort,
  theme,
  onChange,
}: {
  readonly compact: boolean;
  readonly sort: LibrarySort;
  readonly theme: ReaderTheme;
  readonly onChange: (sort: LibrarySort) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={`排序，当前${labelForSort(sort)}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.sortButton,
          {
            backgroundColor: theme.panelMuted,
            borderColor: theme.border,
          },
          pressed && styles.controlPressed,
        ]}
      >
        <Text style={[styles.sortButtonLabel, { color: theme.secondaryText }]}>
          排序
        </Text>
        <Text style={[styles.sortButtonValue, { color: theme.controlText }]}>
          {labelForSort(sort)}
        </Text>
        <Text
          accessibilityElementsHidden
          style={[styles.sortButtonChevron, { color: theme.secondaryText }]}
        >
          ⌄
        </Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View
          style={[
            styles.sortModal,
            compact ? styles.sortModalCompact : styles.sortModalRegular,
          ]}
        >
          <Pressable
            accessibilityLabel="关闭排序菜单"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.sortMenuAnchor,
              compact && styles.sortMenuAnchorCompact,
            ]}
          >
            <View
              accessibilityLabel="选择书架排序"
              accessibilityRole="radiogroup"
              style={[
                styles.sortMenu,
                compact ? styles.sortMenuCompact : styles.sortMenuRegular,
                {
                  backgroundColor: theme.panelRaised,
                  borderColor: theme.border,
                  ...(Platform.OS === "web"
                    ? {}
                    : { shadowColor: theme.shadow }),
                },
              ]}
            >
              <Text style={[styles.sortMenuTitle, { color: theme.text }]}>
                排序方式
              </Text>
              {SORT_OPTIONS.map((option) => {
                const selected = sort === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.sortMenuOption,
                      pressed && { backgroundColor: theme.panelMuted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sortMenuOptionLabel,
                        {
                          color: selected ? theme.accentStrong : theme.text,
                          fontWeight: selected ? "700" : "500",
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      accessibilityElementsHidden
                      style={[
                        styles.sortMenuCheck,
                        { color: theme.accentStrong },
                      ]}
                    >
                      {selected ? "✓" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
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
  onSyncNow,
}: LibraryScreenProps) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 720;
  const contentHorizontalPadding = compact ? 20 : 28;
  const bookGridGap = compact ? 16 : 24;
  const availableContentWidth = windowWidth - contentHorizontalPadding * 2;
  const compactBookColumns = availableContentWidth >= 280 ? 2 : 1;
  const bookCardWidth = compact
    ? Math.min(
        168,
        Math.max(
          132,
          Math.floor(
            (availableContentWidth - bookGridGap * (compactBookColumns - 1)) /
              compactBookColumns,
          ),
        ),
      )
    : 168;
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const visibleEntries = useMemo(
    () => selectLibraryEntries(entries, filter, sort),
    [entries, filter, sort],
  );
  const filterCounts = useMemo(
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

  return (
    <View
      style={[styles.libraryScreen, { backgroundColor: theme.surrounding }]}
    >
      <StatusBar
        backgroundColor="transparent"
        barStyle={
          theme.colorScheme === "dark" ? "light-content" : "dark-content"
        }
        translucent
      />
      <ScrollView
        contentContainerStyle={[
          styles.libraryContent,
          compact && styles.libraryContentCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.libraryHeader, compact && styles.libraryHeaderCompact]}
        >
          <View style={styles.brandRow}>
            <View
              style={[styles.smallBrandMark, { backgroundColor: theme.accent }]}
            >
              <Text
                style={[styles.smallBrandText, { color: theme.panelRaised }]}
              >
                柿
              </Text>
            </View>
            <View>
              <Text style={[styles.appName, { color: theme.text }]}>
                Persimmon
              </Text>
              <Text style={[styles.appTagline, { color: theme.secondaryText }]}>
                一本轻快、安静的 EPUB 阅读器
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.headerActions,
              compact && styles.headerActionsCompact,
            ]}
          >
            <View
              accessibilityLabel="阅读器颜色模式"
              accessibilityRole="radiogroup"
              style={[
                styles.colorModeControl,
                { backgroundColor: theme.panelMuted },
              ]}
            >
              {COLOR_MODE_OPTIONS.map((option) => (
                <SegmentedOption
                  key={option.value}
                  label={option.label}
                  selected={colorMode === option.value}
                  theme={theme}
                  onPress={() => onColorModeChange(option.value)}
                />
              ))}
            </View>
            <Pressable
              accessibilityLabel="导入 EPUB"
              accessibilityRole="button"
              disabled={importing}
              onPress={onImport}
              style={({ pressed }) => [
                styles.importButton,
                { backgroundColor: theme.accent },
                pressed && { opacity: 0.78 },
              ]}
            >
              {importing ? (
                <ActivityIndicator color={theme.panelRaised} size="small" />
              ) : (
                <Text
                  style={[
                    styles.importButtonText,
                    { color: theme.panelRaised },
                  ]}
                >
                  ＋ 导入 EPUB
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.panel,
                borderColor: theme.noteAccent,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: theme.text }]}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onDismissError}
              style={styles.dismissButton}
            >
              <Text style={[styles.dismissText, { color: theme.accentStrong }]}>
                知道了
              </Text>
            </Pressable>
          </View>
        ) : null}

        <GoogleDriveSyncCard
          status={syncStatus}
          theme={theme}
          onConnect={onConnectGoogleDrive}
          onDisconnect={onDisconnectGoogleDrive}
          onSync={onSyncNow}
        />

        <View
          style={[
            styles.librarySectionHeader,
            compact && styles.librarySectionHeaderCompact,
          ]}
        >
          <View>
            <Text style={[styles.sectionTitle, { color: theme.controlText }]}>
              我的书架
            </Text>
            <Text
              style={[styles.sectionSummary, { color: theme.secondaryText }]}
            >
              {filterCounts.reading} 本在读 · {filterCounts.finished} 本已读
            </Text>
          </View>
          <View
            style={[
              styles.libraryControls,
              compact && styles.libraryControlsCompact,
            ]}
          >
            <View
              accessibilityLabel="按阅读状态筛选"
              accessibilityRole="radiogroup"
              style={[
                styles.libraryControlGroup,
                styles.filterControlGroup,
                compact && styles.filterControlGroupCompact,
                { backgroundColor: theme.panelMuted },
              ]}
            >
              {FILTER_OPTIONS.map((option) => (
                <SegmentedOption
                  key={option.value}
                  label={`${option.label} ${filterCounts[option.value]}`}
                  selected={filter === option.value}
                  theme={theme}
                  onPress={() => setFilter(option.value)}
                />
              ))}
            </View>
            <SortControl
              compact={compact}
              sort={sort}
              theme={theme}
              onChange={setSort}
            />
          </View>
        </View>
        <View
          style={[
            styles.bookGrid,
            { columnGap: bookGridGap, rowGap: compact ? 26 : 30 },
          ]}
        >
          {visibleEntries.map((entry) => (
            <BookCard
              key={entry.id}
              entry={entry}
              opening={openingBookId === entry.id}
              theme={theme}
              width={bookCardWidth}
              onDelete={() => onDelete(entry)}
              onOpen={() => onOpen(entry.id)}
            />
          ))}
        </View>
        {visibleEntries.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.panel, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
              这里还没有书
            </Text>
            <Text
              style={[styles.emptyStateBody, { color: theme.secondaryText }]}
            >
              换一个分类，或导入一本新的 EPUB。
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  appName: {
    color: "#2d2924",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  appTagline: {
    color: "#7b7167",
    fontSize: 14,
    marginTop: 3,
  },
  bookCard: {
    width: 168,
  },
  bookCardPressable: {
    width: "100%",
  },
  bookCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  bookGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    minHeight: 40,
  },
  bookMeta: {
    color: "#887e74",
    fontSize: 13,
    marginTop: 4,
  },
  bookProgress: {
    color: "#c65125",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  bookTitle: {
    color: "#342f2a",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 13,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  colorModeControl: {
    borderRadius: 999,
    flexDirection: "row",
    padding: 3,
  },
  controlPressed: {
    opacity: 0.72,
  },
  cover: {
    aspectRatio: 168 / 238,
    backgroundColor: "#e8d4bd",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 10px 16px rgba(62, 44, 32, 0.16)" }
      : {
          shadowColor: "#3e2c20",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
        }),
    borderRadius: 7,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 20,
  },
  coverFruit: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "#dd5a29",
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  coverImage: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%",
  },
  coverLoading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  coverFruitText: {
    color: "#fff6e9",
    fontSize: 22,
    fontWeight: "700",
  },
  coverTitle: {
    color: "#46382d",
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 33,
  },
  deleteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  deleteButtonText: {
    color: "#9b7567",
    fontSize: 12,
  },
  dismissText: {
    color: "#b54620",
    fontSize: 13,
    fontWeight: "700",
  },
  dismissButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 44,
  },
  errorCard: {
    backgroundColor: "#f5dfd5",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    marginBottom: 28,
    padding: 16,
  },
  errorText: {
    color: "#7d321c",
    fontSize: 14,
    lineHeight: 21,
  },
  importButton: {
    alignItems: "center",
    backgroundColor: "#d95f2b",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 136,
    paddingHorizontal: 18,
  },
  importButtonPressed: {
    backgroundColor: "#bd4d21",
  },
  importButtonText: {
    color: "#fffaf3",
    fontSize: 14,
    fontWeight: "700",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-end",
  },
  headerActionsCompact: {
    justifyContent: "space-between",
    width: "100%",
  },
  filterControlGroup: {
    minWidth: 276,
  },
  filterControlGroupCompact: {
    alignSelf: "stretch",
    minWidth: 0,
    width: "100%",
  },
  libraryContent: {
    alignSelf: "center",
    maxWidth: 1080,
    paddingBottom: 64,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "web" ? 48 : 64,
    width: "100%",
  },
  libraryContentCompact: {
    paddingBottom: 44,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "web" ? 32 : 52,
  },
  libraryHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "space-between",
    marginBottom: 40,
  },
  libraryHeaderCompact: {
    alignItems: "flex-start",
    marginBottom: 36,
  },
  libraryControlGroup: {
    borderRadius: 999,
    flexDirection: "row",
    padding: 3,
  },
  libraryControls: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end",
    maxWidth: "100%",
  },
  libraryControlsCompact: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    width: "100%",
  },
  librarySectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
    marginBottom: 22,
  },
  librarySectionHeaderCompact: {
    alignItems: "flex-start",
  },
  libraryScreen: {
    backgroundColor: "#f7f1e8",
    flex: 1,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    padding: 24,
  },
  emptyStateBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  progressFill: {
    borderRadius: 999,
    height: "100%",
  },
  progressTrack: {
    borderRadius: 999,
    height: 3,
    marginTop: 11,
    overflow: "hidden",
    width: "100%",
  },
  reimportText: {
    color: "#a54028",
  },
  sectionTitle: {
    color: "#4b443d",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.45,
  },
  sectionSummary: {
    fontSize: 13,
    marginTop: 6,
  },
  segmentedOption: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  segmentedOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sortButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  sortButtonChevron: {
    fontSize: 15,
    marginLeft: 1,
    marginTop: -3,
  },
  sortButtonLabel: {
    fontSize: 12,
  },
  sortButtonValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  sortMenu: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 8,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 18px 50px rgba(33, 24, 19, 0.24)" }
      : {
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.24,
          shadowRadius: 28,
        }),
    width: 220,
  },
  sortMenuAnchor: {
    alignItems: "flex-end",
    alignSelf: "center",
    maxWidth: 1080,
    width: "100%",
  },
  sortMenuAnchorCompact: {
    alignItems: "stretch",
  },
  sortMenuCheck: {
    fontSize: 16,
    fontWeight: "700",
    width: 22,
  },
  sortMenuCompact: {
    borderRadius: 22,
    margin: 12,
    paddingBottom: 12,
    width: "auto",
  },
  sortMenuOption: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  sortMenuOptionLabel: {
    fontSize: 16,
  },
  sortMenuRegular: {
    marginRight: 28,
    marginTop: 176,
  },
  sortMenuTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    opacity: 0.64,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sortModal: {
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    flex: 1,
  },
  sortModalCompact: {
    justifyContent: "flex-end",
  },
  sortModalRegular: {
    alignItems: "flex-end",
    backgroundColor: "transparent",
  },
  syncActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 10,
  },
  syncCard: {
    alignItems: "center",
    backgroundColor: "#f0e6da",
    borderColor: "rgba(112, 82, 58, 0.10)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "space-between",
    marginBottom: 32,
    paddingHorizontal: 20,
    paddingVertical: 17,
  },
  syncCopy: {
    flex: 1,
    minWidth: 220,
    paddingRight: 18,
  },
  syncDescription: {
    color: "#7f756b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  syncDisconnectButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
  },
  syncDisconnectText: {
    color: "#96786a",
    fontSize: 12,
  },
  syncPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#d95f2b",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 17,
  },
  syncPrimaryButtonText: {
    color: "#fffaf3",
    fontSize: 13,
    fontWeight: "700",
  },
  syncSecondaryButton: {
    alignItems: "center",
    borderColor: "rgba(185, 75, 36, 0.28)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  syncSecondaryButtonText: {
    color: "#b94b24",
    fontSize: 12,
    fontWeight: "600",
  },
  syncTitle: {
    color: "#4a4038",
    fontSize: 15,
    fontWeight: "700",
  },
  smallBrandMark: {
    alignItems: "center",
    backgroundColor: "#df5d2c",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  smallBrandText: {
    color: "#fffaf2",
    fontSize: 25,
    fontWeight: "700",
  },
});
