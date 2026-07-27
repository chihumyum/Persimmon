import { NotoSansSC_400Regular } from "@expo-google-fonts/noto-sans-sc/400Regular";
import type { ReaderProgress } from "@persimmon/reader-skia";
import {
  resolveReaderTheme,
  type ReaderTheme,
} from "@persimmon/reader-skia/theme";
import { EpubImportError } from "@persimmon/epub-import";
import { useFonts } from "expo-font";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  type ReaderColorMode,
  type ReaderPageTurnAnimation,
  type ReaderPageTurnTuning,
  type ReaderSettings,
} from "./library/types";
import { pickAndImportEpub } from "./pick-epub";
import { useSystemReaderColorScheme } from "./reader/reader-color-scheme";
import { resolveReaderColorScheme } from "./reader/reader-color-mode";
import { READER_UI_FONT_FAMILY } from "./reader/reader-ui-typography";
import { LibraryScreen } from "./screens/library-screen";
import { ReaderScreen } from "./screens/reader-screen";
import { googleDriveSyncService } from "./sync/sync-service";
import type { GoogleDriveSyncStatus } from "./sync/types";

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

function LoadingScreen({ theme }: { readonly theme: ReaderTheme }) {
  return (
    <View
      style={[styles.loadingScreen, { backgroundColor: theme.surrounding }]}
    >
      <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
        <Text style={[styles.brandMarkText, { color: theme.panelRaised }]}>
          柿
        </Text>
      </View>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

interface PendingReaderProgress {
  readonly progress: ReaderProgress;
  readonly updatedAt: string;
}

export function PersimmonApp() {
  const systemColorScheme = useSystemReaderColorScheme();
  const [readerUiFontLoaded, readerUiFontError] = useFonts({
    [READER_UI_FONT_FAMILY]: NotoSansSC_400Regular,
  });
  const [entries, setEntries] = useState<readonly LibraryBookSummary[]>([
    demoSummary(),
  ]);
  const [activeBook, setActiveBook] = useState<OpenedLibraryBook | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(
    DEFAULT_READER_SETTINGS,
  );
  const readerSettingsRef = useRef<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [importing, setImporting] = useState(false);
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<GoogleDriveSyncStatus>(
    googleDriveSyncService.getStatus(),
  );
  const progressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pendingProgress = useRef<PendingReaderProgress | undefined>(undefined);
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
          readerSettingsRef.current = settings;
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

  useEffect(() => googleDriveSyncService.subscribe(setSyncStatus), []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    let cancelled = false;
    void googleDriveSyncService.initialize().then(() => {
      if (!cancelled) {
        void refreshLibrary();
      }
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void googleDriveSyncService.syncNow();
        }
      },
    );
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        void googleDriveSyncService.syncNow();
      }
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [hydrated, refreshLibrary]);

  useEffect(() => {
    if (hydrated && syncStatus.phase === "idle") {
      void refreshLibrary();
    }
  }, [hydrated, refreshLibrary, syncStatus]);

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
  const resolvedColorScheme = resolveReaderColorScheme(
    readerSettings.appearance.colorMode,
    systemColorScheme,
  );
  const appTheme = useMemo(
    () =>
      resolveReaderTheme(readerSettings.appearance.theme, resolvedColorScheme),
    [readerSettings.appearance.theme, resolvedColorScheme],
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
      await googleDriveSyncService.noteBookImported(entry);
      await refreshLibrary();
      await openBook(entry.id);
    } catch (importError: unknown) {
      setError(userFacingError(importError));
    } finally {
      setImporting(false);
    }
  }, [openBook, refreshLibrary]);

  const persistPendingProgress = useCallback(async () => {
    const pending = pendingProgress.current;
    if (!pending) {
      return;
    }
    pendingProgress.current = undefined;
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = undefined;
    }
    try {
      await libraryRepository.saveProgress(pending.progress.locator, {
        publicationProgress: pending.progress.publicationProgress,
        updatedAt: pending.updatedAt,
      });
      await googleDriveSyncService.noteProgress(pending.progress.locator);
    } catch {
      pendingProgress.current ??= pending;
      setError("阅读进度保存失败。");
    }
  }, []);

  const updateProgress = useCallback(
    (progress: ReaderProgress) => {
      const updatedAt = new Date().toISOString();
      setEntries((current) =>
        current.map((entry) =>
          entry.id === progress.locator.bookId
            ? {
                ...entry,
                locator: progress.locator,
                readingProgress: progress.publicationProgress,
                lastReadAt: updatedAt,
              }
            : entry,
        ),
      );
      pendingProgress.current = { progress, updatedAt };
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
      progressTimer.current = setTimeout(() => {
        void persistPendingProgress();
      }, 250);
    },
    [persistPendingProgress],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        void persistPendingProgress();
      }
    });
    return () => {
      subscription.remove();
      void persistPendingProgress();
    };
  }, [persistPendingProgress]);

  const updateReaderSettings = useCallback((patch: Partial<ReaderSettings>) => {
    const next = { ...readerSettingsRef.current, ...patch };
    readerSettingsRef.current = next;
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
      updateReaderSettings({ appearance });
    },
    [updateReaderSettings],
  );
  const updateColorMode = useCallback(
    (colorMode: ReaderColorMode) => {
      updateAppearance({ ...readerSettingsRef.current.appearance, colorMode });
    },
    [updateAppearance],
  );
  const updateLayout = useCallback(
    (layout: ReaderSettings["layout"]) => {
      updateReaderSettings({ layout });
    },
    [updateReaderSettings],
  );
  const updatePageTurnTuning = useCallback(
    (pageTurnTuning: ReaderPageTurnTuning) => {
      updateReaderSettings({ pageTurnTuning });
    },
    [updateReaderSettings],
  );
  const updatePageTurnAnimation = useCallback(
    (pageTurnAnimation: ReaderPageTurnAnimation) => {
      updateReaderSettings({ pageTurnAnimation });
    },
    [updateReaderSettings],
  );

  const deleteEntry = useCallback(
    (entry: LibraryBookSummary) => {
      const remove = async () => {
        try {
          await libraryRepository.removeBook(entry.id);
          await googleDriveSyncService.noteBookDeleted(entry.id);
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

  if (!hydrated || (!readerUiFontLoaded && !readerUiFontError)) {
    return <LoadingScreen theme={appTheme} />;
  }

  if (screen.kind === "reader" && activeEntry && activeBook) {
    return (
      <ReaderScreen
        entry={activeEntry}
        appearance={readerSettings.appearance}
        resolvedColorScheme={resolvedColorScheme}
        layout={readerSettings.layout}
        pageTurnAnimation={readerSettings.pageTurnAnimation}
        pageTurnTuning={readerSettings.pageTurnTuning}
        opened={activeBook}
        onBack={() => {
          void persistPendingProgress();
          setActiveBook(null);
          setScreen({ kind: "library" });
        }}
        onAppearanceChange={updateAppearance}
        onLayoutChange={updateLayout}
        onPageTurnAnimationChange={updatePageTurnAnimation}
        onPageTurnTuningChange={updatePageTurnTuning}
        onProgress={updateProgress}
      />
    );
  }

  return (
    <LibraryScreen
      entries={entries}
      colorMode={readerSettings.appearance.colorMode}
      error={error}
      importing={importing}
      openingBookId={openingBookId}
      syncStatus={syncStatus}
      theme={appTheme}
      onConnectGoogleDrive={() => {
        void googleDriveSyncService.connectAndSync();
      }}
      onDelete={deleteEntry}
      onDisconnectGoogleDrive={() => {
        void googleDriveSyncService.disconnect();
      }}
      onDismissError={() => setError(null)}
      onColorModeChange={updateColorMode}
      onImport={importBook}
      onOpen={(bookId) => void openBook(bookId)}
      onSyncNow={() => {
        void googleDriveSyncService.syncNow();
      }}
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
