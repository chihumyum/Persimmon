import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  libraryRepository,
  type LibraryBookSummary,
} from "../library/repository";
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
        <Text style={styles.coverFruitText}>柿</Text>
      </View>
      <Text
        numberOfLines={3}
        style={[styles.coverTitle, { color: theme.controlText }]}
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
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}

function BookCard({ entry, opening, theme, onOpen, onDelete }: BookCardProps) {
  const progress =
    entry.status === "needs-reimport"
      ? "需要重新导入"
      : entry.locator
        ? "继续阅读"
        : "开始阅读";

  return (
    <View style={styles.bookCard}>
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
              shadowColor: theme.shadow,
            },
          ]}
        >
          {opening ? (
            <View style={styles.coverLoading}>
              <ActivityIndicator color={theme.accentStrong} size="small" />
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
        <Text
          style={[
            styles.bookProgress,
            {
              color:
                entry.status === "needs-reimport"
                  ? theme.accentStrong
                  : theme.accent,
            },
          ]}
        >
          {progress}
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
  readonly error: string | null;
  readonly importing: boolean;
  readonly openingBookId: string | null;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly onConnectGoogleDrive: () => void;
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

  return (
    <View
      style={[
        styles.syncCard,
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.syncCopy}>
        <Text style={[styles.syncTitle, { color: theme.controlText }]}>
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
            <Text style={styles.syncPrimaryButtonText}>
              {status.phase === "disconnected" ? "连接" : "重新连接"}
            </Text>
          </Pressable>
        ) : null}
        {status.phase === "idle" || status.phase === "error" ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSync}
            style={[styles.syncSecondaryButton, { borderColor: theme.accent }]}
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

export function LibraryScreen({
  entries,
  error,
  importing,
  openingBookId,
  syncStatus,
  theme,
  onConnectGoogleDrive,
  onDelete,
  onDisconnectGoogleDrive,
  onDismissError,
  onImport,
  onOpen,
  onSyncNow,
}: LibraryScreenProps) {
  return (
    <View style={[styles.libraryScreen, { backgroundColor: theme.paper }]}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={
          theme.colorScheme === "dark" ? "light-content" : "dark-content"
        }
        translucent
      />
      <ScrollView
        contentContainerStyle={styles.libraryContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.libraryHeader}>
          <View style={styles.brandRow}>
            <View
              style={[styles.smallBrandMark, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.smallBrandText}>柿</Text>
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
          <Pressable
            accessibilityLabel="导入 EPUB"
            accessibilityRole="button"
            disabled={importing}
            onPress={onImport}
            style={({ pressed }) => [
              styles.importButton,
              {
                backgroundColor: pressed ? theme.accentStrong : theme.accent,
              },
            ]}
          >
            {importing ? (
              <ActivityIndicator color="#fffaf3" size="small" />
            ) : (
              <Text style={styles.importButtonText}>＋ 导入 EPUB</Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            style={[styles.errorCard, { backgroundColor: theme.panelMuted }]}
          >
            <Text style={[styles.errorText, { color: theme.accentStrong }]}>
              {error}
            </Text>
            <Pressable onPress={onDismissError}>
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

        <Text style={[styles.sectionTitle, { color: theme.controlText }]}>
          我的书架
        </Text>
        <View style={styles.bookGrid}>
          {entries.map((entry) => (
            <BookCard
              key={entry.id}
              entry={entry}
              opening={openingBookId === entry.id}
              theme={theme}
              onDelete={() => onDelete(entry)}
              onOpen={() => onOpen(entry.id)}
            />
          ))}
        </View>

        <View
          style={[
            styles.architectureNote,
            { backgroundColor: theme.panelMuted },
          ]}
        >
          <Text
            style={[styles.architectureTitle, { color: theme.controlText }]}
          >
            Live text, native rhythm.
          </Text>
          <Text
            style={[styles.architectureBody, { color: theme.secondaryText }]}
          >
            BookIR → SkParagraph → Skia。没有 WebView；原 EPUB
            与稳定阅读位置可同步，排版与翻页样式只保留在本机。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  appName: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  appTagline: {
    fontSize: 14,
    marginTop: 3,
  },
  architectureBody: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  architectureNote: {
    borderRadius: 20,
    marginTop: 36,
    padding: 24,
  },
  architectureTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  bookCard: {
    marginBottom: 30,
    marginRight: 24,
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
  },
  bookMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  bookProgress: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 13,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  cover: {
    ...(Platform.OS === "web"
      ? { boxShadow: "0 10px 16px rgba(62, 44, 32, 0.16)" }
      : {
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
        }),
    borderRadius: 7,
    height: 238,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 20,
  },
  coverFruit: {
    alignItems: "center",
    alignSelf: "flex-end",
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
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 33,
  },
  deleteButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 12,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  errorCard: {
    borderRadius: 14,
    marginBottom: 28,
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
  },
  importButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 136,
    paddingHorizontal: 18,
  },
  importButtonText: {
    color: "#fffaf3",
    fontSize: 14,
    fontWeight: "700",
  },
  libraryContent: {
    alignSelf: "center",
    maxWidth: 1080,
    paddingBottom: 64,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "web" ? 48 : 64,
    width: "100%",
  },
  libraryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 48,
  },
  libraryScreen: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 22,
    textTransform: "uppercase",
  },
  syncActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 10,
  },
  syncCard: {
    alignItems: "center",
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
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  syncDisconnectButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  syncDisconnectText: {
    fontSize: 12,
  },
  syncPrimaryButton: {
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 9,
  },
  syncPrimaryButtonText: {
    color: "#fffaf3",
    fontSize: 13,
    fontWeight: "700",
  },
  syncSecondaryButton: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  syncSecondaryButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  syncTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  smallBrandMark: {
    alignItems: "center",
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
