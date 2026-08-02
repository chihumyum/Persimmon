import type { BookPosition } from "@persimmon/book-core";
import type { FontFamilyRecord } from "@persimmon/font-core";
import type { ReaderLayoutMode, ReaderProgress } from "@persimmon/reader-skia";
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
  Platform,
  StatusBar,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AsyncSkia } from "../../components/async-skia";
import { UiButton } from "../components/ui-button";
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
import { ToolbarBreadcrumbCarousel } from "../reader/toolbar-breadcrumb-carousel";
import { useAndroidReaderBack } from "../reader/use-android-reader-back";
import { PageTurnTuningPanel } from "./page-turn-tuning-panel";
import { ReadingSettingsPanel } from "./reading-style-panel";
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
  readonly onProgress: (progress: ReaderProgress) => void;
  readonly onRemoveFont: (familyId: string) => Promise<void>;
}

export function ReaderScreen({
  entry,
  appearance,
  resolvedColorScheme,
  layout,
  pageTurnAnimation,
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
  const [tocVisible, setTocVisible] = useState(false);
  const [turning, setTurning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
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

  const closePanels = useCallback(() => {
    setTocVisible(false);
    setSettingsVisible(false);
    setTuningVisible(false);
  }, []);
  useAndroidReaderBack({
    panelVisible: tocVisible || settingsVisible || tuningVisible,
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
      setSettingsVisible(false);
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
    setTocVisible(false);
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
    appearance.progressDisplay === "header" ||
    appearance.progressDisplay === "both";
  const loadResource = useCallback(
    (assetId: string) => opened.source.getResource(assetId),
    [opened.source],
  );
  const handleCenterPress = useCallback(() => {
    if (turning) {
      return;
    }
    if (controlsVisible) {
      setSettingsVisible(false);
      setTuningVisible(false);
      setTocVisible(false);
    }
    setControlsVisible((visible) => !visible);
  }, [controlsVisible, turning]);
  const handleTurningChange = useCallback((nextTurning: boolean) => {
    setTurning(nextTurning);
    if (nextTurning) {
      setControlsVisible(false);
      setSettingsVisible(false);
      setTuningVisible(false);
      setTocVisible(false);
    }
  }, []);
  const handleSelectionChange = useCallback((nextSelecting: boolean) => {
    setSelecting(nextSelecting);
    if (nextSelecting) {
      setControlsVisible(false);
      setSettingsVisible(false);
      setTuningVisible(false);
      setTocVisible(false);
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
          style={[
            styles.readerPage,
            { backgroundColor: theme.paper },
            layout === "spread" && styles.readerSpread,
          ]}
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
              <AsyncSkia>
                <ReaderSurface
                  key={`${opened.book.revisionId}:${navigationGeneration}`}
                  book={opened.book}
                  width={readerFrame.width}
                  height={readerFrame.height}
                  appearance={appearance}
                  layout={readerFrame.layout}
                  pageTurnAnimation={pageTurnAnimation}
                  theme={theme}
                  topInset={insets.top}
                  bottomInset={insets.bottom}
                  toolbarVisible={controlsVisible}
                  gesturePageTurnTuning={pageTurnTuning.gesture}
                  initialPosition={
                    currentPosition ??
                    navigationTarget ??
                    entry.locator?.position
                  }
                  fontFamilies={fontFamilies}
                  loadFontFace={loadFontFace}
                  loadResource={loadResource}
                  onCenterPress={handleCenterPress}
                  onProgress={handleProgress}
                  onSelectionChange={handleSelectionChange}
                  onTurningChange={handleTurningChange}
                />
              </AsyncSkia>
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
          <UiButton
            accessibilityLabel={t("reader.toolbar.backAccessibility")}
            label={t("reader.toolbar.library")}
            leadingIcon="back"
            onPress={onBack}
            style={styles.backButton}
            textTone="accent"
            theme={theme}
            variant="chrome"
          />
          {toolbarHeaderEnabled ? (
            <View pointerEvents="none" style={styles.toolbarHeaderRow}>
              <ToolbarBreadcrumbCarousel
                color={theme.controlText}
                labels={toolbarNavigationLabels}
              />
            </View>
          ) : null}
          <UiButton
            accessibilityLabel={t("reader.toolbar.tocAccessibility")}
            disabled={navigationRows.length === 0}
            iconOnly
            label={t("reader.toolbar.toc")}
            leadingIcon="toc"
            onPress={() => {
              setSettingsVisible(false);
              setTuningVisible(false);
              setTocVisible((visible) => !visible);
            }}
            theme={theme}
            variant="chrome"
          />
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.bottomControls, { bottom: insets.bottom }]}
        >
          <View pointerEvents="box-none" style={styles.controlGroup}>
            <UiButton
              accessibilityLabel={t("reader.toolbar.settingsAccessibility")}
              iconOnly
              label={t("reader.toolbar.settings")}
              leadingIcon="settings"
              onPress={() => {
                setTuningVisible(false);
                setTocVisible(false);
                setSettingsVisible((visible) => !visible);
              }}
              theme={theme}
              variant="chrome"
            />
            {SHOW_PAGE_TURN_TUNING ? (
              <UiButton
                accessibilityLabel={t("reader.toolbar.tuningAccessibility")}
                iconOnly
                label={t("reader.toolbar.tuning")}
                leadingIcon="tuning"
                onPress={() => {
                  setSettingsVisible(false);
                  setTocVisible(false);
                  setTuningVisible((visible) => !visible);
                }}
                theme={theme}
                variant="chrome"
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

      {!turning && !selecting && controlsVisible && settingsVisible ? (
        <ReadingSettingsPanel
          appearance={appearance}
          fontFamilies={fontFamilies}
          hasBookFonts={Object.keys(opened.book.fontFamilies ?? {}).length > 0}
          layout={layout}
          pageTurnAnimation={pageTurnAnimation}
          theme={theme}
          bottom={
            insets.bottom + uiSize.readerChrome + uiSize.readerChromePanelGap
          }
          onAnimationChange={onPageTurnAnimationChange}
          onChange={onAppearanceChange}
          onClose={() => setSettingsVisible(false)}
          onDownloadFont={onDownloadFont}
          onImportFont={onImportFont}
          onLayoutChange={handleLayoutChange}
          onRemoveFont={onRemoveFont}
        />
      ) : null}

      {!turning && !selecting && controlsVisible && tocVisible ? (
        <TableOfContentsPanel
          currentItemId={activeNavigationPath.at(-1)?.id}
          rows={navigationRows}
          theme={theme}
          top={insets.top + uiSize.readerChrome + uiSize.readerChromePanelGap}
          onClose={() => setTocVisible(false)}
          onSelect={jumpTo}
        />
      ) : null}
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
    ...(Platform.OS === "web"
      ? { boxShadow: "0 10px 24px rgba(61, 48, 38, 0.12)" }
      : {}),
    borderRadius: Platform.OS === "web" ? 12 : 0,
    flex: 1,
    maxWidth: 920,
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
  readerSpread: {
    maxWidth: 1280,
  },
  readerScreen: {
    backgroundColor: "#e8e1d8",
    flex: 1,
  },
  readerStage: {
    alignItems: "center",
    flex: 1,
    padding: Platform.OS === "web" ? 18 : 0,
  },
  topControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: Platform.OS === "web" ? 30 : 12,
    pointerEvents: "box-none",
    position: "absolute",
    right: Platform.OS === "web" ? 30 : 12,
    zIndex: 20,
  },
  bottomControls: {
    alignItems: "center",
    flexDirection: "row",
    pointerEvents: "box-none",
    position: "absolute",
    right: Platform.OS === "web" ? 30 : 12,
    zIndex: 20,
  },
  toolbarHeaderRow: {
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    left: Platform.OS === "web" ? 82 : 80,
    pointerEvents: "none",
    position: "absolute",
    right: Platform.OS === "web" ? 82 : 80,
    top: 0,
  },
  controlGroup: {
    flexDirection: "row",
    gap: uiSpace.sm,
    pointerEvents: "box-none",
  },
  backButton: {
    paddingLeft: 9,
    paddingRight: 12,
  },
});
