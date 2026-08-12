import { NotoSansSC_400Regular } from "@expo-google-fonts/noto-sans-sc/400Regular";
import {
  BUILTIN_READER_SERIF_ID,
  type FontFamilyRecord,
} from "@persimmon/font-core";
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
  StyleSheet,
  View,
} from "react-native";

import { exportEpub } from "./export-epub";
import { BUILTIN_FONT_FAMILIES } from "./fonts/builtin-fonts";
import { downloadFontFamily } from "./fonts/download-font";
import { DOWNLOADABLE_FONT_CATALOG } from "./fonts/downloadable-font-catalog";
import { fontRepository } from "./fonts/font-repository";
import { FontRepositoryError } from "./fonts/types";
import { translate, type AppLanguagePreference } from "./i18n";
import { useAppLanguage } from "./i18n/use-app-language";
import { importEpubBatch, type FailedEpubImport } from "./import-epub-batch";
import {
  libraryRepository,
  type LibraryBookSummary,
  type OpenedLibraryBook,
} from "./library/repository";
import {
  IMPORT_COMPLETION_VISIBLE_MS,
  type LibraryImportStatus,
} from "./library/library-import-banner";
import { ProgressWriteQueue } from "./library/progress-write-queue";
import {
  DEFAULT_READER_SETTINGS,
  LibraryError,
  type ReaderAppearanceSettings,
  type ReaderColorMode,
  type ReaderPageTurnAnimation,
  type ReaderPageTurnTuning,
  type ReaderSettings,
  type ReaderThemeName,
} from "./library/types";
import { pickEpubs } from "./pick-epub";
import { pickLocalFont } from "./pick-font";
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
        return translate("errors.epub.fixedLayout");
      case "archive-limit-exceeded":
        return translate("errors.epub.archiveLimit");
      case "unsafe-archive-path":
        return translate("errors.epub.unsafePath");
      default:
        return translate("errors.epub.unreadable", { message: error.message });
    }
  }
  if (error instanceof LibraryError) {
    switch (error.code) {
      case "book-not-found":
        return translate("errors.library.bookNotFound");
      case "needs-reimport":
        return translate("errors.library.needsReimport");
      case "corrupt-storage":
        return translate("errors.library.corruptStorage");
      case "storage-full":
        return translate("errors.library.storageFull");
    }
  }
  if (error instanceof FontRepositoryError) {
    switch (error.code) {
      case "font-not-found":
        return translate("errors.fonts.notFound");
      case "invalid-font":
        return translate("errors.fonts.invalid");
      case "integrity-mismatch":
        return translate("errors.fonts.integrity");
      case "storage-full":
        return translate("errors.fonts.storageFull");
    }
  }
  return error instanceof Error ? error.message : translate("errors.unknown");
}

function importFailureMessage(
  failures: readonly FailedEpubImport[],
  importedCount: number,
): string {
  const summary = importedCount
    ? translate("errors.import.withImported", {
        count: failures.length,
        importedCount,
      })
    : translate("errors.import.failed", { count: failures.length });
  const details = failures
    .map(({ error, fileName }) =>
      translate("errors.import.detail", {
        fileName,
        message: userFacingError(error),
      }),
    )
    .join("\n");
  return `${summary}\n${details}`;
}

function LoadingScreen({ theme }: { readonly theme: ReaderTheme }) {
  return (
    <View
      style={[styles.loadingScreen, { backgroundColor: theme.surrounding }]}
    >
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

export function PersimmonApp() {
  const { languagePreference, languageReady, setLanguagePreference } =
    useAppLanguage();
  const systemColorScheme = useSystemReaderColorScheme();
  const [readerUiFontLoaded, readerUiFontError] = useFonts({
    [READER_UI_FONT_FAMILY]: NotoSansSC_400Regular,
  });
  const [entries, setEntries] = useState<readonly LibraryBookSummary[]>([]);
  const [fontFamilies, setFontFamilies] = useState<readonly FontFamilyRecord[]>(
    BUILTIN_FONT_FAMILIES,
  );
  const [activeBook, setActiveBook] = useState<OpenedLibraryBook | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(
    DEFAULT_READER_SETTINGS,
  );
  const readerSettingsRef = useRef<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<LibraryImportStatus>();
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<GoogleDriveSyncStatus>(
    googleDriveSyncService.getStatus(),
  );
  const [dataClearing, setDataClearing] = useState<"local" | "cloud" | null>(
    null,
  );
  const progressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const importCompletionTimer = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const progressWriter = useRef<ProgressWriteQueue | undefined>(undefined);
  progressWriter.current ??= new ProgressWriteQueue(async (snapshot) => {
    await googleDriveSyncService.noteProgress(
      snapshot.progress.locator,
      snapshot.progress.publicationProgress,
      snapshot.updatedAt,
    );
  });
  const persistProgressRef = useRef<() => Promise<void>>(async () => undefined);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const settingsWrite = useRef<Promise<void>>(Promise.resolve());
  const readerActivityRelease = useRef<(() => void) | undefined>(undefined);

  const releaseReaderActivity = useCallback(() => {
    const release = readerActivityRelease.current;
    readerActivityRelease.current = undefined;
    release?.();
  }, []);

  const refreshLibrary = useCallback(async () => {
    setEntries(await libraryRepository.listBooks());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const library = libraryRepository.initialize().then(async () => {
      const [books, settings] = await Promise.all([
        libraryRepository.listBooks(),
        libraryRepository.getSettings(),
      ]);
      return { books, settings };
    });
    const fonts = fontRepository
      .initialize()
      .then(() => fontRepository.listFamilies())
      .catch((fontError: unknown) => {
        if (!cancelled) {
          setError(
            translate("errors.fonts.loadFailed", {
              message: userFacingError(fontError),
            }),
          );
        }
        return BUILTIN_FONT_FAMILIES;
      });
    Promise.all([library, fonts])
      .then(([loadedLibrary, loadedFonts]) => {
        if (!cancelled) {
          setEntries(loadedLibrary.books);
          setFontFamilies(loadedFonts);
          readerSettingsRef.current = loadedLibrary.settings;
          setReaderSettings(loadedLibrary.settings);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            translate("errors.library.loadFailed", {
              message: userFacingError(loadError),
            }),
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
    if (screen.kind !== "library") {
      return;
    }
    return googleDriveSyncService.subscribe(setSyncStatus);
  }, [screen.kind]);

  useEffect(() => {
    if (screen.kind !== "library") {
      return;
    }
    return googleDriveSyncService.subscribeLibraryChanges(refreshLibrary);
  }, [refreshLibrary, screen.kind]);

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
    if (hydrated && screen.kind === "library" && syncStatus.phase === "idle") {
      void refreshLibrary();
    }
  }, [hydrated, refreshLibrary, screen.kind, syncStatus]);

  useEffect(
    () => () => {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
      if (settingsTimer.current) {
        clearTimeout(settingsTimer.current);
      }
      if (importCompletionTimer.current) {
        clearTimeout(importCompletionTimer.current);
      }
      releaseReaderActivity();
    },
    [releaseReaderActivity],
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

  const openBook = useCallback(
    async (bookId: string) => {
      setError(null);
      setOpeningBookId(bookId);
      releaseReaderActivity();
      const release = googleDriveSyncService.beginReaderActivity();
      readerActivityRelease.current = release;
      try {
        const opened = await libraryRepository.openBook(bookId);
        setActiveBook(opened);
        setScreen({ kind: "reader", bookId });
      } catch (openError: unknown) {
        if (readerActivityRelease.current === release) {
          releaseReaderActivity();
        }
        setError(userFacingError(openError));
      } finally {
        setOpeningBookId(null);
      }
    },
    [releaseReaderActivity],
  );

  const importBook = useCallback(async () => {
    setError(null);
    if (importCompletionTimer.current) {
      clearTimeout(importCompletionTimer.current);
      importCompletionTimer.current = undefined;
    }
    setImportStatus(undefined);
    setImporting(true);
    try {
      const pickedEpubs = await pickEpubs();
      if (pickedEpubs.length === 0) {
        return;
      }
      const result = await importEpubBatch(
        pickedEpubs,
        (input) => libraryRepository.importBook(input),
        (progress) => setImportStatus({ phase: "importing", ...progress }),
      );
      for (const imported of result.imported) {
        try {
          await googleDriveSyncService.noteBookImported(imported.value);
        } catch {
          setError(
            translate("errors.import.syncRecordFailed", {
              fileName: imported.fileName,
              message: translate("sync.errors.failed"),
            }),
          );
        }
      }
      if (result.imported.length > 0) {
        await refreshLibrary();
      }
      if (result.failures.length > 0) {
        setError(importFailureMessage(result.failures, result.imported.length));
      }
      setImportStatus({
        phase: "complete",
        completedBooks: pickedEpubs.length,
        failedBooks: result.failures.length,
        importedBooks: result.imported.length,
        totalBooks: pickedEpubs.length,
      });
      importCompletionTimer.current = setTimeout(() => {
        importCompletionTimer.current = undefined;
        setImportStatus(undefined);
      }, IMPORT_COMPLETION_VISIBLE_MS);
    } catch (importError: unknown) {
      setImportStatus(undefined);
      setError(userFacingError(importError));
    } finally {
      setImporting(false);
    }
  }, [refreshLibrary]);

  const importFont = useCallback(async (): Promise<string | undefined> => {
    setError(null);
    try {
      const picked = await pickLocalFont();
      if (!picked) {
        return undefined;
      }
      const family = await fontRepository.installFont({
        bytes: picked.bytes,
        source: "user",
      });
      setFontFamilies(await fontRepository.listFamilies());
      return family.id;
    } catch (fontError: unknown) {
      setError(userFacingError(fontError));
      throw fontError;
    }
  }, []);
  const downloadFont = useCallback(
    async (familyId: string): Promise<string> => {
      setError(null);
      const family = DOWNLOADABLE_FONT_CATALOG.families.find(
        (candidate) => candidate.id === familyId,
      );
      if (!family) {
        throw new FontRepositoryError(
          "font-not-found",
          translate("errors.fonts.catalogNotFound"),
        );
      }
      try {
        const installed = await downloadFontFamily(family, fontRepository);
        setFontFamilies(await fontRepository.listFamilies());
        return installed.id;
      } catch (fontError: unknown) {
        setError(userFacingError(fontError));
        throw fontError;
      }
    },
    [],
  );

  const loadFontFace = useCallback(
    (faceId: string) => fontRepository.readFace(faceId),
    [],
  );

  const persistPendingProgress = useCallback(async () => {
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = undefined;
    }
    try {
      await progressWriter.current?.flush();
    } catch {
      setError(translate("errors.library.progressSaveFailed"));
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
      if (progressWriter.current?.hasPending()) {
        progressTimer.current = setTimeout(() => {
          progressTimer.current = undefined;
          void persistProgressRef.current();
        }, 1_500);
      }
    }
  }, []);
  persistProgressRef.current = persistPendingProgress;

  const updateProgress = useCallback((progress: ReaderProgress) => {
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
    progressWriter.current?.enqueue({ progress, updatedAt });
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
    }
    progressTimer.current = setTimeout(() => {
      progressTimer.current = undefined;
      void persistProgressRef.current();
    }, 250);
  }, []);

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
      settingsTimer.current = undefined;
      settingsWrite.current = settingsWrite.current
        .then(() => libraryRepository.saveSettings(next))
        .catch(() => setError(translate("errors.library.settingsSaveFailed")));
    }, 250);
  }, []);
  const updateAppearance = useCallback(
    (appearance: ReaderAppearanceSettings) => {
      updateReaderSettings({ appearance });
    },
    [updateReaderSettings],
  );
  const removeFont = useCallback(
    async (familyId: string): Promise<void> => {
      setError(null);
      try {
        await fontRepository.removeFamily(familyId);
        setFontFamilies(await fontRepository.listFamilies());
        if (
          readerSettingsRef.current.appearance.font.selectedFontId === familyId
        ) {
          updateReaderSettings({
            appearance: {
              ...readerSettingsRef.current.appearance,
              font: {
                ...readerSettingsRef.current.appearance.font,
                selectedFontId: BUILTIN_READER_SERIF_ID,
              },
            },
          });
        }
      } catch (fontError: unknown) {
        setError(userFacingError(fontError));
        throw fontError;
      }
    },
    [updateReaderSettings],
  );
  const updateColorMode = useCallback(
    (colorMode: ReaderColorMode) => {
      updateAppearance({ ...readerSettingsRef.current.appearance, colorMode });
    },
    [updateAppearance],
  );
  const updateTheme = useCallback(
    (theme: ReaderThemeName) => {
      updateAppearance({ ...readerSettingsRef.current.appearance, theme });
    },
    [updateAppearance],
  );
  const updateLanguagePreference = useCallback(
    (preference: AppLanguagePreference) => {
      void setLanguagePreference(preference).catch(() =>
        setError(translate("errors.languagePreferenceSaveFailed")),
      );
    },
    [setLanguagePreference],
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
  const updateRapidPageTurnEnabled = useCallback(
    (rapidPageTurnEnabled: boolean) => {
      updateReaderSettings({ rapidPageTurnEnabled });
    },
    [updateReaderSettings],
  );

  const deleteEntry = useCallback(
    (entry: LibraryBookSummary) => {
      const remove = async () => {
        try {
          await libraryRepository.removeBook(entry.id);
        } catch (deleteError: unknown) {
          setError(userFacingError(deleteError));
          return;
        }
        try {
          await googleDriveSyncService.noteBookDeleted(entry.id);
        } catch {
          setError(translate("sync.errors.failed"));
        }
        await refreshLibrary();
      };

      Alert.alert(
        translate("errors.library.deleteTitle"),
        translate("errors.library.deleteConfirmation", { title: entry.title }),
        [
          { text: translate("common.cancel"), style: "cancel" },
          {
            text: translate("common.delete"),
            style: "destructive",
            onPress: () => void remove(),
          },
        ],
      );
    },
    [refreshLibrary],
  );

  const syncBook = useCallback(async (entry: LibraryBookSummary) => {
    setError(null);
    await googleDriveSyncService.syncNow();
    const refreshedEntries = await libraryRepository.listBooks();
    setEntries(refreshedEntries);
    const refreshed = refreshedEntries.find(
      (candidate) => candidate.id === entry.id,
    );
    if (entry.status === "needs-reimport" && refreshed?.status !== "ready") {
      setError(translate("errors.library.cloudRepairUnavailable"));
    }
  }, []);

  const exportEntry = useCallback(async (entry: LibraryBookSummary) => {
    try {
      await exportEpub(entry);
    } catch (exportError: unknown) {
      Alert.alert(
        translate("library.error.title"),
        userFacingError(exportError),
      );
    }
  }, []);

  const clearLocalData = useCallback(async () => {
    setDataClearing("local");
    setError(null);
    try {
      await persistPendingProgress();
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = undefined;
      }
      progressWriter.current?.discardPending();
      if (settingsTimer.current) {
        clearTimeout(settingsTimer.current);
        settingsTimer.current = undefined;
      }
      await settingsWrite.current;
      releaseReaderActivity();
      await googleDriveSyncService.disconnectAndResetLocalState();
      await libraryRepository.clearAllData();
      readerSettingsRef.current = DEFAULT_READER_SETTINGS;
      setReaderSettings(DEFAULT_READER_SETTINGS);
      setFontFamilies(BUILTIN_FONT_FAMILIES);
      setEntries([]);
      setActiveBook(null);
      setOpeningBookId(null);
      setScreen({ kind: "library" });
      await fontRepository.clearInstalledFonts();
      Alert.alert(
        translate("settings.data.clearLocalCompleteTitle"),
        translate("settings.data.clearLocalCompleteMessage"),
      );
    } catch {
      setError(translate("settings.data.clearLocalFailedMessage"));
      Alert.alert(
        translate("settings.data.clearLocalFailedTitle"),
        translate("settings.data.clearLocalFailedMessage"),
      );
    } finally {
      setDataClearing(null);
    }
  }, [persistPendingProgress, releaseReaderActivity]);

  const clearCloudData = useCallback(async () => {
    setDataClearing("cloud");
    setError(null);
    try {
      await googleDriveSyncService.clearCloudData();
      Alert.alert(
        translate("settings.data.clearCloudCompleteTitle"),
        translate("settings.data.clearCloudCompleteMessage"),
      );
    } catch {
      setError(translate("settings.data.clearCloudFailedMessage"));
      Alert.alert(
        translate("settings.data.clearCloudFailedTitle"),
        translate("settings.data.clearCloudFailedMessage"),
      );
    } finally {
      setDataClearing(null);
    }
  }, []);

  if (
    !languageReady ||
    !hydrated ||
    (!readerUiFontLoaded && !readerUiFontError)
  ) {
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
        rapidPageTurnEnabled={readerSettings.rapidPageTurnEnabled}
        pageTurnTuning={readerSettings.pageTurnTuning}
        opened={activeBook}
        fontFamilies={fontFamilies}
        loadFontFace={loadFontFace}
        onBack={() => {
          const release = readerActivityRelease.current;
          readerActivityRelease.current = undefined;
          setActiveBook(null);
          setScreen({ kind: "library" });
          void refreshLibrary();
          void persistPendingProgress().finally(() => release?.());
        }}
        onAppearanceChange={updateAppearance}
        onDownloadFont={downloadFont}
        onImportFont={importFont}
        onLayoutChange={updateLayout}
        onPageTurnAnimationChange={updatePageTurnAnimation}
        onPageTurnTuningChange={updatePageTurnTuning}
        onRapidPageTurnEnabledChange={updateRapidPageTurnEnabled}
        onProgress={updateProgress}
        onRemoveFont={removeFont}
      />
    );
  }

  return (
    <LibraryScreen
      entries={entries}
      colorMode={readerSettings.appearance.colorMode}
      dataClearing={dataClearing}
      readerThemeName={readerSettings.appearance.theme}
      error={error}
      importStatus={importStatus}
      importing={importing}
      languagePreference={languagePreference}
      openingBookId={openingBookId}
      syncStatus={syncStatus}
      theme={appTheme}
      onConnectGoogleDrive={() => {
        void googleDriveSyncService.connectAndSync();
      }}
      onClearCloudData={() => {
        void clearCloudData();
      }}
      onClearLocalData={() => {
        void clearLocalData();
      }}
      onDelete={deleteEntry}
      onDisconnectGoogleDrive={() => {
        void googleDriveSyncService.disconnect();
      }}
      onDismissError={() => setError(null)}
      onExport={exportEntry}
      onColorModeChange={updateColorMode}
      onImport={importBook}
      onLanguagePreferenceChange={updateLanguagePreference}
      onOpen={(bookId) => void openBook(bookId)}
      onSyncBook={(entry) => {
        void syncBook(entry);
      }}
      onSyncNow={() => {
        void googleDriveSyncService.syncNow();
      }}
      onThemeChange={updateTheme}
    />
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: "center",
    backgroundColor: "#f7f1e8",
    flex: 1,
    justifyContent: "center",
  },
});
