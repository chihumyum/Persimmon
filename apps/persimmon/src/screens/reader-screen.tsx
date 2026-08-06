import type { BookPosition } from "@persimmon/book-core";
import type { FontFamilyRecord } from "@persimmon/font-core";
import {
  PAGE_DECORATION_LINE_HEIGHT,
  PAGE_DECORATION_TOP_OFFSET,
  type ReaderLayoutMode,
  type ReaderProgress,
} from "@persimmon/reader-skia";
import {
  resolveReaderTheme,
  type ResolvedReaderColorScheme,
} from "@persimmon/reader-skia/theme";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ReaderChromeButton } from "../components/reader-chrome-button";
import { uiSize, uiSpace } from "../components/ui-tokens";
import type {
  LibraryBookSummary,
  OpenedLibraryBook,
} from "../library/repository";
import type {
  ReaderAppearanceSettings,
  ReaderPageTurnAnimation,
  ReaderPageTurnTuning,
} from "../library/types";
import { navigationPathForPosition } from "../reader/navigation-path";
import type {
  ReaderOverlayState,
  ReaderSettingsTab,
} from "../reader/reader-overlay-state";
import { resetReaderTypography } from "../reader/reader-typography-preview";
import { ToolbarBreadcrumbCarousel } from "../reader/toolbar-breadcrumb-carousel";
import { useAndroidReaderBack } from "../reader/use-android-reader-back";
import { PageTurnTuningPanel } from "./page-turn-tuning-panel";
import { ReadingSettingsSheet } from "./reading-settings-sheet";
import {
  flattenNavigation,
  TableOfContentsPanel,
} from "./table-of-contents-panel";

const ReaderSurface = React.lazy(() => import("../reader/reader-surface"));
const SHOW_PAGE_TURN_TUNING = false;

interface Viewport {
  readonly width: number;
  readonly height: number;
}

interface ReaderFrame extends Viewport {
  readonly layout: ReaderLayoutMode;
}

export interface ReaderScreenProps {
  readonly entry: LibraryBookSummary;
  readonly appearance: ReaderAppearanceSettings;
  readonly resolvedColorScheme: ResolvedReaderColorScheme;
  readonly layout: ReaderLayoutMode;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly rapidPageTurnEnabled: boolean;
  readonly pageTurnTuning: ReaderPageTurnTuning;
  readonly opened: OpenedLibraryBook;
  readonly fontFamilies: readonly FontFamilyRecord[];
  readonly loadFontFace: (faceId: string) => Promise<Uint8Array | undefined>;
  readonly onBack: () => void;
  readonly onAppearanceChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onDownloadFont: (familyId: string) => Promise<string>;
  readonly onImportFont: () => Promise<string | undefined>;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
  readonly onPageTurnAnimationChange: (
    animation: ReaderPageTurnAnimation,
  ) => void;
  readonly onPageTurnTuningChange: (tuning: ReaderPageTurnTuning) => void;
  readonly onRapidPageTurnEnabledChange: (enabled: boolean) => void;
  readonly onProgress: (progress: ReaderProgress) => void;
  readonly onRemoveFont: (familyId: string) => Promise<void>;
}

export function ReaderScreen({
  entry,
  appearance,
  resolvedColorScheme,
  layout,
  pageTurnAnimation,
  rapidPageTurnEnabled,
  pageTurnTuning,
  opened,
  fontFamilies,
  loadFontFace,
  onBack,
  onAppearanceChange,
  onDownloadFont,
  onImportFont,
  onLayoutChange,
  onPageTurnAnimationChange,
  onPageTurnTuningChange,
  onRapidPageTurnEnabledChange,
  onProgress,
  onRemoveFont,
}: ReaderScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useMemo(
    () => resolveReaderTheme(appearance.theme, resolvedColorScheme),
    [appearance.theme, resolvedColorScheme],
  );
  const [readerFrame, setReaderFrame] = useState<ReaderFrame | null>(null);
  const measuredViewportRef = useRef<Viewport | null>(null);
  const [turning, setTurning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [overlay, setOverlay] = useState<ReaderOverlayState>({ kind: "none" });
  const [lastSettingsTab, setLastSettingsTab] =
    useState<ReaderSettingsTab>("typography");
  const [typographyDraft, setTypographyDraft] = useState<
    ReaderAppearanceSettings | undefined
  >();
  const [layoutTransitioning, setLayoutTransitioning] = useState(false);
  const [tuningVisible, setTuningVisible] = useState(false);
  const layoutTransitioningRef = useRef(false);
  const pendingLayoutRef = useRef<ReaderLayoutMode | undefined>(undefined);
  const layoutFrameRef = useRef(0);
  const [navigationTarget, setNavigationTarget] = useState<
    BookPosition | undefined
  >();
  const [currentPosition, setCurrentPosition] = useState<
    BookPosition | undefined
  >(entry.locator?.position);
  const [navigationGeneration, setNavigationGeneration] = useState(0);
  const navigationRows = useMemo(
    () => flattenNavigation(opened.book.navigation ?? []),
    [opened.book.navigation],
  );

  const displayedAppearance = typographyDraft ?? appearance;

  const closeTypographyPreview = useCallback(() => {
    if (typographyDraft) {
      onAppearanceChange(typographyDraft);
    }
    setTypographyDraft(undefined);
    setOverlay({ kind: "none" });
  }, [onAppearanceChange, typographyDraft]);

  const returnFromTypographyPreview = useCallback(() => {
    if (typographyDraft) {
      onAppearanceChange(typographyDraft);
    }
    setTypographyDraft(undefined);
    setOverlay((current) =>
      current.kind === "settings" ? { ...current, page: "root" } : current,
    );
  }, [onAppearanceChange, typographyDraft]);

  const changeSettingsTab = useCallback(
    (tab: ReaderSettingsTab) => {
      setLastSettingsTab(tab);
      if (typographyDraft) {
        onAppearanceChange(typographyDraft);
      }
      setTypographyDraft(undefined);
      setOverlay((current) =>
        current.kind === "settings"
          ? { ...current, page: "root", tab }
          : current,
      );
    },
    [onAppearanceChange, typographyDraft],
  );

  const closePanels = useCallback(() => {
    if (overlay.kind === "settings" && overlay.page === "typographyPreview") {
      returnFromTypographyPreview();
      return;
    }
    if (overlay.kind === "settings" && overlay.page === "fonts") {
      setOverlay({ ...overlay, page: "root" });
      return;
    }
    setOverlay({ kind: "none" });
    setTuningVisible(false);
  }, [overlay, returnFromTypographyPreview]);
  useAndroidReaderBack({
    // Native modal sheets own Android Back. Keeping the React Native handler
    // active at the same time can consume one press twice (navigate within the
    // sheet and then immediately close it).
    enabled: overlay.kind === "none",
    panelVisible: overlay.kind !== "none" || tuningVisible,
    onBack,
    onClosePanels: closePanels,
  });

  const cancelLayoutFrame = useCallback(() => {
    if (layoutFrameRef.current) {
      cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = 0;
    }
  }, []);
  useEffect(
    () => () => {
      cancelLayoutFrame();
      pendingLayoutRef.current = undefined;
      layoutTransitioningRef.current = false;
    },
    [cancelLayoutFrame],
  );
  useEffect(() => {
    if (pendingLayoutRef.current !== layout) {
      return;
    }
    // The container can resize after the layout setting changes. Commit that
    // measured viewport and the reader mode together. The Skia engine stays
    // mounted and replaces only geometry-dependent pagination and captures.
    cancelLayoutFrame();
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = 0;
        const measuredViewport = measuredViewportRef.current;
        if (measuredViewport) {
          setReaderFrame({ ...measuredViewport, layout });
        }
        pendingLayoutRef.current = undefined;
        layoutTransitioningRef.current = false;
        setLayoutTransitioning(false);
      });
    });
  }, [cancelLayoutFrame, layout]);
  const handleLayoutChange = useCallback(
    (nextLayout: ReaderLayoutMode) => {
      if (
        nextLayout === layout ||
        layoutTransitioningRef.current ||
        turning ||
        selecting
      ) {
        return;
      }
      pendingLayoutRef.current = nextLayout;
      layoutTransitioningRef.current = true;
      setLayoutTransitioning(true);
      cancelLayoutFrame();
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = requestAnimationFrame(() => {
          layoutFrameRef.current = 0;
          onLayoutChange(nextLayout);
        });
      });
    },
    [cancelLayoutFrame, layout, onLayoutChange, selecting, turning],
  );

  const measureReader = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0) {
        const measuredViewport = { width, height };
        measuredViewportRef.current = measuredViewport;
        if (layoutTransitioningRef.current) {
          return;
        }
        setReaderFrame((current) =>
          current?.width === width &&
          current.height === height &&
          current.layout === layout
            ? current
            : { ...measuredViewport, layout },
        );
      }
    },
    [layout],
  );

  const jumpTo = useCallback((position: BookPosition) => {
    setNavigationTarget(position);
    setCurrentPosition(position);
    setNavigationGeneration((current) => current + 1);
    setOverlay({ kind: "none" });
  }, []);
  const handleProgress = useCallback(
    (progress: ReaderProgress) => {
      setCurrentPosition(progress.locator.position);
      onProgress(progress);
    },
    [onProgress],
  );
  const activeNavigationPath = useMemo(
    () => navigationPathForPosition(opened.book, currentPosition),
    [currentPosition, opened.book],
  );
  const toolbarNavigationLabels = useMemo(() => {
    const labels = activeNavigationPath
      .map((item) => item.label.trim())
      .filter(Boolean);
    if (labels.length > 0) {
      return labels;
    }
    const sectionTitle = currentPosition
      ? opened.book.sections
          .find((section) => section.id === currentPosition.sectionId)
          ?.title?.trim()
      : opened.book.sections[0]?.title?.trim();
    return [sectionTitle || opened.book.title];
  }, [activeNavigationPath, currentPosition, opened.book]);
  const toolbarHeaderEnabled =
    displayedAppearance.progressDisplay === "header" ||
    displayedAppearance.progressDisplay === "both";
  const loadResource = useCallback(
    (assetId: string) => opened.source.getResource(assetId),
    [opened.source],
  );
  const handleCenterPress = useCallback(() => {
    if (turning) {
      return;
    }
    if (controlsVisible) {
      setTuningVisible(false);
      setOverlay({ kind: "none" });
    }
    setControlsVisible((visible) => !visible);
  }, [controlsVisible, turning]);
  const handleTurningChange = useCallback((nextTurning: boolean) => {
    setTurning(nextTurning);
    if (nextTurning) {
      setControlsVisible(false);
      setTuningVisible(false);
      setOverlay({ kind: "none" });
    }
  }, []);
  const handleSelectionChange = useCallback((nextSelecting: boolean) => {
    setSelecting(nextSelecting);
    if (nextSelecting) {
      setControlsVisible(false);
      setTuningVisible(false);
      setOverlay({ kind: "none" });
    }
  }, []);

  return (
    <View style={[styles.readerScreen, { backgroundColor: theme.surrounding }]}>
      <StatusBar
        backgroundColor="transparent"
        barStyle={
          theme.colorScheme === "dark" ? "light-content" : "dark-content"
        }
        translucent
      />

      <View style={styles.readerStage}>
        <View
          onLayout={measureReader}
          style={[styles.readerPage, { backgroundColor: theme.paper }]}
        >
          {readerFrame ? (
            <Suspense
              fallback={
                <View
                  style={[
                    styles.readerLoading,
                    { backgroundColor: theme.paper },
                  ]}
                >
                  <ActivityIndicator color={theme.accent} />
                </View>
              }
            >
              <ReaderSurface
                key={`${opened.book.revisionId}:${navigationGeneration}`}
                book={opened.book}
                width={readerFrame.width}
                height={readerFrame.height}
                appearance={displayedAppearance}
                layout={readerFrame.layout}
                pageTurnAnimation={pageTurnAnimation}
                rapidPageTurnEnabled={rapidPageTurnEnabled}
                theme={theme}
                topInset={insets.top}
                bottomInset={insets.bottom}
                toolbarVisible={controlsVisible}
                gesturePageTurnTuning={pageTurnTuning.gesture}
                initialPosition={
                  currentPosition ?? navigationTarget ?? entry.locator?.position
                }
                fontFamilies={fontFamilies}
                loadFontFace={loadFontFace}
                loadResource={loadResource}
                onCenterPress={handleCenterPress}
                onProgress={handleProgress}
                onSelectionChange={handleSelectionChange}
                onTurningChange={handleTurningChange}
              />
            </Suspense>
          ) : null}
          {readerFrame && layoutTransitioning ? (
            <View
              style={[
                styles.readerTransitionOverlay,
                { backgroundColor: theme.paper },
              ]}
            >
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : null}
        </View>
      </View>

      {!turning && !selecting && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.topControls, { top: insets.top }]}
        >
          <ReaderChromeButton
            accessibilityLabel={t("reader.toolbar.backAccessibility")}
            icon="back"
            label={t("reader.toolbar.library")}
            onPress={onBack}
            theme={theme}
            tintColor={theme.accentStrong}
          />
          {toolbarHeaderEnabled ? (
            <View pointerEvents="none" style={styles.toolbarHeaderRow}>
              <ToolbarBreadcrumbCarousel
                color={theme.decoration}
                labels={toolbarNavigationLabels}
              />
            </View>
          ) : null}
          <ReaderChromeButton
            accessibilityLabel={t("reader.toolbar.tocAccessibility")}
            disabled={navigationRows.length === 0}
            icon="toc"
            label={t("reader.toolbar.toc")}
            onPress={() => {
              setTuningVisible(false);
              setOverlay((current) =>
                current.kind === "toc" ? { kind: "none" } : { kind: "toc" },
              );
            }}
            theme={theme}
          />
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.bottomControls, { bottom: insets.bottom }]}
        >
          <View pointerEvents="box-none" style={styles.controlGroup}>
            <ReaderChromeButton
              accessibilityLabel={t("reader.toolbar.settingsAccessibility")}
              icon="typography"
              label={t("reader.toolbar.settings")}
              onPress={() => {
                setTuningVisible(false);
                setOverlay((current) =>
                  current.kind === "settings"
                    ? { kind: "none" }
                    : {
                        kind: "settings",
                        page: "root",
                        tab: lastSettingsTab,
                      },
                );
              }}
              theme={theme}
            />
            {SHOW_PAGE_TURN_TUNING ? (
              <ReaderChromeButton
                accessibilityLabel={t("reader.toolbar.tuningAccessibility")}
                icon="tuning"
                label={t("reader.toolbar.tuning")}
                onPress={() => {
                  setOverlay({ kind: "none" });
                  setTuningVisible((visible) => !visible);
                }}
                theme={theme}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible && tuningVisible ? (
        <PageTurnTuningPanel
          theme={theme}
          bottom={
            insets.bottom + uiSize.readerChrome + uiSize.readerChromePanelGap
          }
          tuning={pageTurnTuning}
          onChange={onPageTurnTuningChange}
          onClose={() => setTuningVisible(false)}
        />
      ) : null}

      <ReadingSettingsSheet
        activeTab={overlay.kind === "settings" ? overlay.tab : lastSettingsTab}
        appearance={displayedAppearance}
        bottomInset={insets.bottom}
        fontFamilies={fontFamilies}
        hasBookFonts={Object.keys(opened.book.fontFamilies ?? {}).length > 0}
        layout={layout}
        page={overlay.kind === "settings" ? overlay.page : "root"}
        pageTurnAnimation={pageTurnAnimation}
        rapidPageTurnEnabled={rapidPageTurnEnabled}
        theme={theme}
        visible={overlay.kind === "settings"}
        onAnimationChange={onPageTurnAnimationChange}
        onAppearanceChange={onAppearanceChange}
        onBackPress={closePanels}
        onClose={() => {
          if (
            overlay.kind === "settings" &&
            overlay.page === "typographyPreview"
          ) {
            closeTypographyPreview();
            return;
          }
          setOverlay((current) =>
            current.kind === "settings" ? { kind: "none" } : current,
          );
        }}
        onDownloadFont={onDownloadFont}
        onImportFont={onImportFont}
        onLayoutChange={handleLayoutChange}
        onPageChange={(page) =>
          setOverlay((current) =>
            current.kind === "settings" ? { ...current, page } : current,
          )
        }
        onRapidPageTurnEnabledChange={onRapidPageTurnEnabledChange}
        onRemoveFont={onRemoveFont}
        onStartTypographyPreview={() => {
          setTypographyDraft(appearance);
          setOverlay((current) =>
            current.kind === "settings"
              ? { ...current, page: "typographyPreview" }
              : current,
          );
        }}
        onTabChange={changeSettingsTab}
        onTypographyChange={(key, value) =>
          setTypographyDraft((current) =>
            current ? { ...current, [key]: value } : current,
          )
        }
        onTypographyBack={returnFromTypographyPreview}
        onTypographyReset={() =>
          setTypographyDraft((current) =>
            current ? resetReaderTypography(current) : current,
          )
        }
      />

      <TableOfContentsPanel
        bottomInset={insets.bottom}
        currentItemId={activeNavigationPath.at(-1)?.id}
        rows={navigationRows}
        theme={theme}
        visible={overlay.kind === "toc"}
        onClose={() =>
          setOverlay((current) =>
            current.kind === "toc" ? { kind: "none" } : current,
          )
        }
        onSelect={jumpTo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  readerLoading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  readerPage: {
    borderRadius: 0,
    flex: 1,
    overflow: "hidden",
    width: "100%",
  },
  readerTransitionOverlay: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 5,
  },
  readerScreen: {
    backgroundColor: "#e8e1d8",
    flex: 1,
  },
  readerStage: {
    alignItems: "center",
    flex: 1,
    padding: 0,
  },
  topControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 12,
    position: "absolute",
    right: 12,
    zIndex: 20,
  },
  bottomControls: {
    alignItems: "center",
    flexDirection: "row",
    position: "absolute",
    right: 12,
    zIndex: 20,
  },
  toolbarHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    height: PAGE_DECORATION_LINE_HEIGHT,
    justifyContent: "center",
    left: uiSize.control + uiSpace.sm,
    pointerEvents: "none",
    position: "absolute",
    right: uiSize.control + uiSpace.sm,
    top: PAGE_DECORATION_TOP_OFFSET,
  },
  controlGroup: {
    flexDirection: "row",
    gap: uiSpace.sm,
    pointerEvents: "box-none",
  },
});
