import type { ReaderProgress } from "@persimmon/reader-skia";
import { EpubImportError } from "@persimmon/epub-import";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { demoSummary } from "./library/demo";
import {
  libraryRepository,
  type LibraryBookSummary,
  type OpenedLibraryBook,
} from "./library/repository";
import {
  DEFAULT_READER_SETTINGS,
  LibraryError,
  type ReaderAppearanceSettings,
  type ReaderPageTurnTuning,
  type ReaderSettings,
} from "./library/types";
import { pickAndImportEpub } from "./pick-epub";
import { LibraryScreen } from "./screens/library-screen";
import { ReaderScreen } from "./screens/reader-screen";

type Screen = { kind: "library" } | { kind: "reader"; bookId: string };

function userFacingError(error: unknown): string {
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
  if (error instanceof LibraryError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "发生未知错误。";
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

export function PersimmonApp() {
  const [entries, setEntries] = useState<readonly LibraryBookSummary[]>([
    demoSummary(),
  ]);
  const [activeBook, setActiveBook] = useState<OpenedLibraryBook | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(
    DEFAULT_READER_SETTINGS,
  );
  const [importing, setImporting] = useState(false);
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pendingProgress = useRef<ReaderProgress | undefined>(undefined);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const refreshLibrary = useCallback(async () => {
    setEntries(await libraryRepository.listBooks());
  }, []);

  useEffect(() => {
    let cancelled = false;
    libraryRepository
      .initialize()
      .then(async () => {
        const [books, settings] = await Promise.all([
          libraryRepository.listBooks(),
          libraryRepository.getSettings(),
        ]);
        if (!cancelled) {
          setEntries(books);
          setReaderSettings(settings);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(`无法读取本地书架：${userFacingError(loadError)}`);
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

  useEffect(
    () => () => {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
      if (settingsTimer.current) {
        clearTimeout(settingsTimer.current);
      }
    },
    [],
  );

  const activeEntry = useMemo(
    () =>
      screen.kind === "reader"
        ? entries.find((entry) => entry.id === screen.bookId)
        : undefined,
    [entries, screen],
  );

  const openBook = useCallback(async (bookId: string) => {
    setError(null);
    setOpeningBookId(bookId);
    try {
      const opened = await libraryRepository.openBook(bookId);
      setActiveBook(opened);
      setScreen({ kind: "reader", bookId });
    } catch (openError: unknown) {
      setError(userFacingError(openError));
    } finally {
      setOpeningBookId(null);
    }
  }, []);

  const importBook = useCallback(async () => {
    setError(null);
    setImporting(true);
    try {
      const picked = await pickAndImportEpub();
      if (!picked) {
        return;
      }
      const entry = await libraryRepository.importBook({
        bytes: picked.bytes,
        fileName: picked.fileName,
      });
      await refreshLibrary();
      await openBook(entry.id);
    } catch (importError: unknown) {
      setError(userFacingError(importError));
    } finally {
      setImporting(false);
    }
  }, [openBook, refreshLibrary]);

  const updateProgress = useCallback((progress: ReaderProgress) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === progress.locator.bookId
          ? { ...entry, locator: progress.locator }
          : entry,
      ),
    );
    pendingProgress.current = progress;
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
    }
    progressTimer.current = setTimeout(() => {
      const pending = pendingProgress.current;
      if (pending) {
        libraryRepository
          .saveProgress(pending.locator)
          .catch(() => setError("本地阅读进度保存失败。"));
      }
    }, 250);
  }, []);

  const updateReaderSettings = useCallback((next: ReaderSettings) => {
    setReaderSettings(next);
    if (settingsTimer.current) {
      clearTimeout(settingsTimer.current);
    }
    settingsTimer.current = setTimeout(() => {
      libraryRepository
        .saveSettings(next)
        .catch(() => setError("阅读设置保存失败。"));
    }, 250);
  }, []);
  const updateAppearance = useCallback(
    (appearance: ReaderAppearanceSettings) => {
      updateReaderSettings({ ...readerSettings, appearance });
    },
    [readerSettings, updateReaderSettings],
  );
  const updateLayout = useCallback(
    (layout: ReaderSettings["layout"]) => {
      updateReaderSettings({ ...readerSettings, layout });
    },
    [readerSettings, updateReaderSettings],
  );
  const updatePageTurnTuning = useCallback(
    (pageTurnTuning: ReaderPageTurnTuning) => {
      updateReaderSettings({ ...readerSettings, pageTurnTuning });
    },
    [readerSettings, updateReaderSettings],
  );

  const deleteEntry = useCallback(
    (entry: LibraryBookSummary) => {
      const remove = async () => {
        try {
          await libraryRepository.removeBook(entry.id);
          await refreshLibrary();
        } catch (deleteError: unknown) {
          setError(userFacingError(deleteError));
        }
      };

      if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
        if (globalThis.confirm(`确定删除《${entry.title}》及其本地资源吗？`)) {
          void remove();
        }
        return;
      }
      Alert.alert("删除书籍", `确定删除《${entry.title}》及其本地资源吗？`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: () => void remove() },
      ]);
    },
    [refreshLibrary],
  );

  if (!hydrated) {
    return <LoadingScreen />;
  }

  if (screen.kind === "reader" && activeEntry && activeBook) {
    return (
      <ReaderScreen
        entry={activeEntry}
        appearance={readerSettings.appearance}
        layout={readerSettings.layout}
        pageTurnTuning={readerSettings.pageTurnTuning}
        opened={activeBook}
        onBack={() => {
          setActiveBook(null);
          setScreen({ kind: "library" });
        }}
        onAppearanceChange={updateAppearance}
        onLayoutChange={updateLayout}
        onPageTurnTuningChange={updatePageTurnTuning}
        onProgress={updateProgress}
      />
    );
  }

  return (
    <LibraryScreen
      entries={entries}
      error={error}
      importing={importing}
      openingBookId={openingBookId}
      onDelete={deleteEntry}
      onDismissError={() => setError(null)}
      onImport={importBook}
      onOpen={(bookId) => void openBook(bookId)}
    />
  );
}

const styles = StyleSheet.create({
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
  loadingScreen: {
    alignItems: "center",
    backgroundColor: "#f7f1e8",
    flex: 1,
    justifyContent: "center",
  },
});
