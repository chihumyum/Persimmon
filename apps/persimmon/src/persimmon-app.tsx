import type { ReaderProgress } from "@persimmon/reader-skia";
import { EpubImportError } from "@persimmon/epub-import";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AsyncSkia } from "../components/async-skia";
import {
  createDemoEntry,
  loadLibrary,
  saveLibrary,
  type LibraryEntry,
} from "./library-store";
import { pickAndImportEpub } from "./pick-epub";

const ReaderSurface = React.lazy(
  () => import("./reader/reader-surface"),
);

type Screen =
  | { kind: "library" }
  | { kind: "reader"; bookId: string };

interface Viewport {
  width: number;
  height: number;
}

function importErrorMessage(error: unknown): string {
  if (error instanceof EpubImportError) {
    switch (error.code) {
      case "unsupported-fixed-layout":
        return "暂不支持固定版式 EPUB；第一版专注可重排小说。";
      case "archive-limit-exceeded":
        return "这本书超过第一版的安全导入限制。";
      case "unsafe-archive-path":
        return "EPUB 内含不安全路径，已拒绝导入。";
      default:
        return `无法读取这本 EPUB：${error.message}`;
    }
  }
  return error instanceof Error
    ? error.message
    : "导入 EPUB 时发生未知错误。";
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>柿</Text>
      </View>
      <ActivityIndicator color="#d95f2b" />
    </View>
  );
}

interface BookCardProps {
  entry: LibraryEntry;
  onOpen: () => void;
}

function BookCard({ entry, onOpen }: BookCardProps) {
  const progress = entry.locator ? "继续阅读" : "开始阅读";
  return (
    <Pressable
      accessibilityLabel={`打开 ${entry.book.title}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.bookCard,
        pressed && styles.bookCardPressed,
      ]}
    >
      <View style={styles.cover}>
        <View style={styles.coverFruit}>
          <Text style={styles.coverFruitText}>柿</Text>
        </View>
        <Text numberOfLines={3} style={styles.coverTitle}>
          {entry.book.title}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.bookTitle}>
        {entry.book.title}
      </Text>
      <Text numberOfLines={1} style={styles.bookMeta}>
        {entry.author ?? entry.sourceName}
      </Text>
      <Text style={styles.bookProgress}>{progress}</Text>
    </Pressable>
  );
}

export function PersimmonApp() {
  const [entries, setEntries] = useState<LibraryEntry[]>([
    createDemoEntry(),
  ]);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [fontSize, setFontSize] = useState(20);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((loaded) => {
        if (!cancelled) {
          setEntries(loaded);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? `无法读取本地书架：${loadError.message}`
              : "无法读取本地书架。",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const timer = setTimeout(() => {
      saveLibrary(entries).catch(() => {
        setError("本地阅读进度保存失败。");
      });
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [entries, hydrated]);

  const activeEntry = useMemo(
    () =>
      screen.kind === "reader"
        ? entries.find((entry) => entry.id === screen.bookId)
        : undefined,
    [entries, screen],
  );

  const openBook = useCallback((bookId: string) => {
    setViewport(null);
    setScreen({ kind: "reader", bookId });
  }, []);

  const importBook = useCallback(async () => {
    setError(null);
    setImporting(true);
    try {
      const imported = await pickAndImportEpub();
      if (!imported) {
        return;
      }
      const entry: LibraryEntry = {
        id: imported.result.book.id,
        book: imported.result.book,
        author: imported.result.metadata.author,
        sourceName: imported.fileName,
        addedAt: new Date().toISOString(),
      };
      setEntries((current) => [
        ...current.filter((item) => item.id !== entry.id),
        entry,
      ]);
      openBook(entry.id);
    } catch (importError: unknown) {
      setError(importErrorMessage(importError));
    } finally {
      setImporting(false);
    }
  }, [openBook]);

  const updateProgress = useCallback(
    (progress: ReaderProgress) => {
      if (screen.kind !== "reader") {
        return;
      }
      setEntries((current) =>
        current.map((entry) => {
          if (entry.id !== screen.bookId) {
            return entry;
          }
          const previous = entry.locator?.position;
          const next = progress.locator.position;
          if (
            entry.locator?.revisionId ===
              progress.locator.revisionId &&
            previous?.sectionId === next.sectionId &&
            previous.blockId === next.blockId &&
            previous.offset === next.offset
          ) {
            return entry;
          }
          return { ...entry, locator: progress.locator };
        }),
      );
    },
    [screen],
  );

  const measureReader = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport((current) =>
        current?.width === width && current.height === height
          ? current
          : { width, height },
      );
    }
  }, []);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (screen.kind === "reader" && activeEntry) {
    return (
      <View style={styles.readerScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.readerToolbar}>
          <Pressable
            accessibilityLabel="返回书架"
            accessibilityRole="button"
            onPress={() => setScreen({ kind: "library" })}
            style={styles.toolbarButton}
          >
            <Text style={styles.toolbarButtonText}>‹ 书架</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.readerTitle}>
            {activeEntry.book.title}
          </Text>
          <View style={styles.typeControls}>
            <Pressable
              accessibilityLabel="减小字号"
              accessibilityRole="button"
              disabled={fontSize <= 16}
              onPress={() =>
                setFontSize((current) => Math.max(16, current - 2))
              }
              style={styles.typeButton}
            >
              <Text style={styles.typeButtonText}>A−</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="增大字号"
              accessibilityRole="button"
              disabled={fontSize >= 30}
              onPress={() =>
                setFontSize((current) => Math.min(30, current + 2))
              }
              style={styles.typeButton}
            >
              <Text style={styles.typeButtonText}>A+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.readerStage}>
          <View
            onLayout={measureReader}
            style={styles.readerPage}
          >
            {viewport ? (
              <Suspense
                fallback={
                  <View style={styles.readerLoading}>
                    <ActivityIndicator color="#d95f2b" />
                  </View>
                }
              >
                <AsyncSkia />
                <ReaderSurface
                  book={activeEntry.book}
                  width={viewport.width}
                  height={viewport.height}
                  fontSize={fontSize}
                  initialPosition={activeEntry.locator?.position}
                  onProgress={updateProgress}
                />
              </Suspense>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.libraryScreen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.libraryContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.libraryHeader}>
          <View style={styles.brandRow}>
            <View style={styles.smallBrandMark}>
              <Text style={styles.smallBrandText}>柿</Text>
            </View>
            <View>
              <Text style={styles.appName}>Persimmon</Text>
              <Text style={styles.appTagline}>
                一本轻快、安静的 EPUB 阅读器
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="导入 EPUB"
            accessibilityRole="button"
            disabled={importing}
            onPress={importBook}
            style={({ pressed }) => [
              styles.importButton,
              pressed && styles.importButtonPressed,
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
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => setError(null)}>
              <Text style={styles.dismissText}>知道了</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>我的书架</Text>
        <View style={styles.bookGrid}>
          {entries.map((entry) => (
            <BookCard
              key={entry.id}
              entry={entry}
              onOpen={() => openBook(entry.id)}
            />
          ))}
        </View>

        <View style={styles.architectureNote}>
          <Text style={styles.architectureTitle}>
            Live text, native rhythm.
          </Text>
          <Text style={styles.architectureBody}>
            BookIR → SkParagraph → Skia。没有 WebView，也没有截图翻页。
          </Text>
        </View>
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
  architectureBody: {
    color: "#7f756b",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  architectureNote: {
    backgroundColor: "#eee4d7",
    borderRadius: 20,
    marginTop: 36,
    padding: 24,
  },
  architectureTitle: {
    color: "#4a4038",
    fontSize: 18,
    fontWeight: "700",
  },
  bookCard: {
    marginBottom: 30,
    marginRight: 24,
    width: 168,
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
  brandMark: {
    alignItems: "center",
    backgroundColor: "#df5d2c",
    borderRadius: 25,
    height: 78,
    justifyContent: "center",
    marginBottom: 24,
    width: 78,
  },
  brandMarkText: {
    color: "#fffaf2",
    fontSize: 38,
    fontWeight: "700",
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  cover: {
    backgroundColor: "#e8d4bd",
    borderRadius: 7,
    height: 238,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 20,
    shadowColor: "#3e2c20",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
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
  dismissText: {
    color: "#b54620",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: "#f5dfd5",
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
    backgroundColor: "#f7f1e8",
    flex: 1,
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: "#f7f1e8",
    flex: 1,
    justifyContent: "center",
  },
  readerLoading: {
    alignItems: "center",
    backgroundColor: "#fbf7f0",
    flex: 1,
    justifyContent: "center",
  },
  readerPage: {
    backgroundColor: "#fbf7f0",
    borderRadius: Platform.OS === "web" ? 12 : 0,
    flex: 1,
    maxWidth: 920,
    overflow: "hidden",
    shadowColor: "#3d3026",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === "web" ? 0.12 : 0,
    shadowRadius: 24,
    width: "100%",
  },
  readerScreen: {
    backgroundColor: "#e8e1d8",
    flex: 1,
  },
  readerStage: {
    alignItems: "center",
    flex: 1,
    padding: Platform.OS === "web" ? 18 : 0,
    paddingTop: 0,
  },
  readerTitle: {
    color: "#4b443d",
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    marginHorizontal: 12,
    textAlign: "center",
  },
  readerToolbar: {
    alignItems: "center",
    backgroundColor: "#f4eee6",
    borderBottomColor: "#ddd3c8",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: Platform.OS === "web" ? 54 : 64,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 0 : 10,
  },
  sectionTitle: {
    color: "#4b443d",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 22,
    textTransform: "uppercase",
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
  toolbarButton: {
    minWidth: 70,
    paddingVertical: 10,
  },
  toolbarButtonText: {
    color: "#b94b24",
    fontSize: 15,
    fontWeight: "600",
  },
  typeButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 42,
  },
  typeButtonText: {
    color: "#5c534b",
    fontSize: 14,
    fontWeight: "700",
  },
  typeControls: {
    flexDirection: "row",
    minWidth: 84,
  },
});
