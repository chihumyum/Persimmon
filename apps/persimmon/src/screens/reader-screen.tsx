import type { BookPosition } from "@persimmon/book-core";
import type { FontFamilyRecord } from "@persimmon/font-core";
import {
  pageDecorationHeaderY,
  pageDecorationInlineMargin,
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
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useTranslation } from "react-i18next";

import { useDuoLayout } from "../../modules/persimmon-duo-layout";
import { AppStatusBar } from "../../modules/persimmon-status-bar";
import { ReaderChromeButton } from "../components/reader-chrome-button";
import {
  systemColumnCenterInset,
  systemColumnOcclusionBottom,
} from "../components/system-column";
import {
  appTopControlOffset,
  uiScreen,
  uiSize,
  uiSpace,
} from "../components/ui-tokens";
import type {
  LibraryBookSummary,
  OpenedLibraryBook,
} from "../library/repository";
import type {
  ReaderAppearanceSettings,
  ReaderPageTurnAnimation,
  ReaderPageTurnTuning,
} from "../library/types";
import type { ReaderLayoutPreference } from "../library/types";
import { navigationPathForPosition } from "../reader/navigation-path";
import {
  nextStableReaderGeometry,
  readerChromeLayout,
  readerPageFrameInsets,
  readerSystemColumn,
  type StableReaderGeometry,
} from "../reader/reader-chrome-layout";
import type {
  ReaderOverlayState,
  ReaderSettingsTab,
} from "../reader/reader-overlay-state";
import { effectiveReaderLayout } from "../reader/reader-layout-mode";
import { resetReaderTypography } from "../reader/reader-typography-preview";
import { ReaderChromeTitle } from "../reader/reader-chrome-title";
import { toolbarBreadcrumbLabel } from "../reader/toolbar-breadcrumb";
import { useAndroidReaderBack } from "../reader/use-android-reader-back";
import { ReadingSettingsSheet } from "./reading-settings-sheet";
import {
  flattenNavigation,
  TableOfContentsPanel,
} from "./table-of-contents-panel";

const ReaderSurface = React.lazy(() => import("../reader/reader-surface"));

const CHROME_SHOW_TIMING = {
  duration: 260,
  easing: Easing.out(Easing.cubic),
};
const CHROME_HIDE_TIMING = {
  duration: 220,
  easing: Easing.inOut(Easing.cubic),
};
/** A page turn or selection only gives the buttons a quick fade. */
const CHROME_INTERRUPT_TIMING = { duration: 120 };
/** How much smaller the buttons are when fully hidden. */
const CHROME_BUTTON_SCALE = 0.14;

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
  readonly layoutPreference: ReaderLayoutPreference;
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
  readonly onLayoutPreferenceChange: (
    preference: ReaderLayoutPreference,
  ) => void;
  readonly onPageTurnAnimationChange: (
    animation: ReaderPageTurnAnimation,
  ) => void;
  readonly onRapidPageTurnEnabledChange: (enabled: boolean) => void;
  readonly onProgress: (progress: ReaderProgress) => void;
  readonly onRemoveFont: (familyId: string) => Promise<void>;
}

export function ReaderScreen({
  entry,
  appearance,
  resolvedColorScheme,
  layoutPreference,
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
  onLayoutPreferenceChange,
  onPageTurnAnimationChange,
  onRapidPageTurnEnabledChange,
  onProgress,
  onRemoveFont,
}: ReaderScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const duoLayout = useDuoLayout();
  const [overlay, setOverlay] = useState<ReaderOverlayState>({ kind: "none" });
  // Reader geometry follows the live window and safe area, except under an
  // open sheet: a sheet may bring the status bar back, and that must not
  // repaginate the book or move the controls.
  const liveColumn = readerSystemColumn(insets, uiSize.control);
  const [stableGeometry, setStableGeometry] = useState<StableReaderGeometry>();
  const nextGeometry = nextStableReaderGeometry(
    stableGeometry,
    `${windowWidth}x${windowHeight}`,
    {
      top: insets.top,
      left: insets.left,
      bottom: insets.bottom,
      right: insets.right,
      columnOcclusionBottom: liveColumn
        ? systemColumnOcclusionBottom(
            duoLayout.occlusions,
            windowWidth,
            liveColumn.side,
            liveColumn.width,
          )
        : 0,
    },
    overlay.kind !== "none",
  );
  if (nextGeometry !== stableGeometry) {
    setStableGeometry(nextGeometry);
  }
  const readerInsets = nextGeometry.geometry;
  const horizontalInsets = {
    left: readerInsets.left,
    right: readerInsets.right,
  };
  // A system column beside the reader (the iPhone Duo outer display) only
  // holds the camera and the hidden status bar while reading, so the page
  // runs beneath it. The reader controls still sit in the column, over the
  // page.
  const chromeColumn = readerSystemColumn(horizontalInsets, uiSize.control);
  const readingInsets = chromeColumn
    ? { ...horizontalInsets, [chromeColumn.side]: 0 }
    : horizontalInsets;
  // The layout the window and preference ask for. `frameLayout` follows it
  // through a transition that commits the resized page frame and the new
  // layout to the engine together, so a fold or rotation paginates once.
  const targetLayout = effectiveReaderLayout(layoutPreference, {
    width: windowWidth,
    height: windowHeight,
    insets: readingInsets,
  });
  const targetLayoutRef = useRef(targetLayout);
  targetLayoutRef.current = targetLayout;
  const [frameLayout, setFrameLayout] = useState(targetLayout);
  const frameLayoutRef = useRef(frameLayout);
  frameLayoutRef.current = frameLayout;
  const topControlOffset = appTopControlOffset(windowWidth, readerInsets.top);
  const theme = useMemo(
    () => resolveReaderTheme(appearance.theme, resolvedColorScheme),
    [appearance.theme, resolvedColorScheme],
  );
  const [readerFrame, setReaderFrame] = useState<ReaderFrame | null>(null);
  const measuredViewportRef = useRef<Viewport | null>(null);
  const [turning, setTurning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [lastSettingsTab, setLastSettingsTab] =
    useState<ReaderSettingsTab>("typography");
  const [typographyDraft, setTypographyDraft] = useState<
    ReaderAppearanceSettings | undefined
  >();
  const [layoutTransitioning, setLayoutTransitioning] = useState(false);
  const layoutTransitioningRef = useRef(false);
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
  }, [overlay, returnFromTypographyPreview]);
  useAndroidReaderBack({
    // Native modal sheets own Android Back. Keeping the React Native handler
    // active at the same time can consume one press twice (navigate within the
    // sheet and then immediately close it).
    enabled: overlay.kind === "none",
    panelVisible: overlay.kind !== "none",
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
      layoutTransitioningRef.current = false;
    },
    [cancelLayoutFrame],
  );
  // Commits the measured viewport and `nextLayout` together two frames after
  // the page frame resized, so the transition overlay is on screen first. The
  // Skia engine stays mounted and replaces only geometry-dependent pagination
  // and captures.
  const finishLayoutTransition = useCallback(
    (nextLayout: ReaderLayoutMode) => {
      cancelLayoutFrame();
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = requestAnimationFrame(() => {
          layoutFrameRef.current = 0;
          const measuredViewport = measuredViewportRef.current;
          if (measuredViewport) {
            setReaderFrame({ ...measuredViewport, layout: nextLayout });
          }
          layoutTransitioningRef.current = false;
          setLayoutTransitioning(false);
        });
      });
    },
    [cancelLayoutFrame],
  );
  // A fold, rotation, Split View or new preference can change the layout at
  // any time. Page turns and selections finish on the layout they started
  // with; the switch follows as soon as they end.
  useEffect(() => {
    if (
      targetLayout === frameLayout ||
      layoutTransitioning ||
      turning ||
      selecting
    ) {
      return;
    }
    layoutTransitioningRef.current = true;
    setLayoutTransitioning(true);
    cancelLayoutFrame();
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = 0;
        const nextLayout = targetLayoutRef.current;
        if (nextLayout === frameLayoutRef.current) {
          finishLayoutTransition(nextLayout);
        } else {
          setFrameLayout(nextLayout);
        }
      });
    });
  }, [
    cancelLayoutFrame,
    finishLayoutTransition,
    frameLayout,
    layoutTransitioning,
    selecting,
    targetLayout,
    turning,
  ]);
  useEffect(() => {
    if (layoutTransitioningRef.current) {
      finishLayoutTransition(frameLayout);
    }
  }, [finishLayoutTransition, frameLayout]);

  const measureReader = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }
    const measuredViewport = { width, height };
    measuredViewportRef.current = measuredViewport;
    // While a layout switch is pending, the transition commits the final
    // size together with the new layout.
    if (
      layoutTransitioningRef.current ||
      targetLayoutRef.current !== frameLayoutRef.current
    ) {
      return;
    }
    const layout = frameLayoutRef.current;
    setReaderFrame((current) =>
      current?.width === width &&
      current.height === height &&
      current.layout === layout
        ? current
        : { ...measuredViewport, layout },
    );
  }, []);

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
  const chromeLayout = readerChromeLayout({
    windowWidth,
    insets: horizontalInsets,
    headerLabel: toolbarBreadcrumbLabel(toolbarNavigationLabels),
    topControlOffset,
    columnOcclusionBottom: readerInsets.columnOcclusionBottom,
    columnCenterInset: chromeColumn
      ? systemColumnCenterInset(
          duoLayout.occlusions,
          windowWidth,
          chromeColumn.side,
          chromeColumn.width,
        )
      : 0,
    metrics: {
      control: uiSize.control,
      edgeInset: uiScreen.horizontalInset,
      gap: uiSpace.sm,
    },
  });
  const pageFrameInsets = readerPageFrameInsets(frameLayout, readingInsets);
  const loadResource = useCallback(
    (assetId: string) => opened.source.getResource(assetId),
    [opened.source],
  );
  const handleCenterPress = useCallback(() => {
    if (turning) {
      return;
    }
    if (controlsVisible) {
      setOverlay({ kind: "none" });
    }
    setControlsVisible((visible) => !visible);
  }, [controlsVisible, turning]);
  const handleTurningChange = useCallback((nextTurning: boolean) => {
    setTurning(nextTurning);
    if (nextTurning) {
      setControlsVisible(false);
      setOverlay({ kind: "none" });
    }
  }, []);
  const handleSelectionChange = useCallback((nextSelecting: boolean) => {
    setSelecting(nextSelecting);
    if (nextSelecting) {
      setControlsVisible(false);
      setOverlay({ kind: "none" });
    }
  }, []);

  // The reader chrome (buttons and toolbar title) animates in and out with
  // one progress value and stays mounted until the hide animation ends. A
  // page turn or selection hides it faster and never blocks the gesture.
  const chromeShown = controlsVisible && !turning && !selecting;
  const chromeInterrupted = turning || selecting;
  const chromeProgress = useSharedValue(chromeShown ? 1 : 0);
  const [chromeMounted, setChromeMounted] = useState(chromeShown);
  const chromeRendered = chromeShown || chromeMounted;
  const unmountChrome = useCallback(() => setChromeMounted(false), []);
  useEffect(() => {
    if (chromeShown) {
      setChromeMounted(true);
      chromeProgress.value = withTiming(1, CHROME_SHOW_TIMING);
      return;
    }
    chromeProgress.value = withTiming(
      0,
      chromeInterrupted ? CHROME_INTERRUPT_TIMING : CHROME_HIDE_TIMING,
      (finished) => {
        if (finished) {
          scheduleOnRN(unmountChrome);
        }
      },
    );
  }, [chromeInterrupted, chromeProgress, chromeShown, unmountChrome]);
  const chromeButtonStyle = useAnimatedStyle(() => ({
    opacity: chromeProgress.value,
    transform: [
      { scale: 1 - CHROME_BUTTON_SCALE * (1 - chromeProgress.value) },
    ],
  }));
  const decorationMargin = pageDecorationInlineMargin(
    displayedAppearance.horizontalMargin,
    readerFrame?.width ??
      windowWidth - pageFrameInsets.left - pageFrameInsets.right,
    frameLayout === "spread" ? 2 : 1,
  );

  return (
    <View style={[styles.readerScreen, { backgroundColor: theme.surrounding }]}>
      <AppStatusBar
        barStyle={
          theme.colorScheme === "dark" ? "light-content" : "dark-content"
        }
        hidden
      />

      <View style={[styles.readerStage, { backgroundColor: theme.paper }]}>
        <View
          onLayout={measureReader}
          style={[
            styles.readerPage,
            {
              backgroundColor: theme.paper,
              left: pageFrameInsets.left,
              right: pageFrameInsets.right,
            },
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
                topInset={readerInsets.top}
                bottomInset={readerInsets.bottom}
                toolbarVisible={controlsVisible}
                automaticPageTurnTuning={pageTurnTuning.click.forward}
                reverseAutomaticPageTurnTuning={pageTurnTuning.click.backward}
                gesturePageTurnTuning={pageTurnTuning.gesture.forward}
                reverseGesturePageTurnTuning={pageTurnTuning.gesture.backward}
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

      {toolbarHeaderEnabled && chromeRendered && !chromeInterrupted ? (
        <ReaderChromeTitle
          color={theme.decoration}
          paperColor={theme.paper}
          progress={chromeProgress}
          readingFrame={{
            left: pageFrameInsets.left + decorationMargin,
            right: pageFrameInsets.right + decorationMargin,
          }}
          toolbarFrame={chromeLayout.header}
          toolbarLabels={toolbarNavigationLabels}
          top={pageDecorationHeaderY(readerInsets.top, readerInsets.bottom)}
          windowWidth={windowWidth}
        />
      ) : null}

      {chromeRendered ? (
        <Animated.View
          pointerEvents={chromeShown ? "box-none" : "none"}
          style={[
            styles.topControls,
            {
              [chromeLayout.back.side]: chromeLayout.back.offset,
              top: chromeLayout.back.top,
            },
            chromeButtonStyle,
          ]}
        >
          <ReaderChromeButton
            accessibilityLabel={t("reader.toolbar.backAccessibility")}
            icon="back"
            label={t("reader.toolbar.library")}
            onPress={onBack}
            theme={theme}
            tintColor={theme.accentStrong}
          />
        </Animated.View>
      ) : null}

      {chromeRendered ? (
        <Animated.View
          pointerEvents={chromeShown ? "box-none" : "none"}
          style={[
            styles.bottomControls,
            {
              bottom: readerInsets.bottom,
              right: chromeLayout.trailingButtonsRight,
            },
            chromeButtonStyle,
          ]}
        >
          <View pointerEvents="box-none" style={styles.controlGroup}>
            <ReaderChromeButton
              accessibilityLabel={t("reader.toolbar.tocAccessibility")}
              disabled={navigationRows.length === 0}
              icon="toc"
              label={t("reader.toolbar.toc")}
              onPress={() => {
                setOverlay((current) =>
                  current.kind === "toc" ? { kind: "none" } : { kind: "toc" },
                );
              }}
              theme={theme}
            />
            <ReaderChromeButton
              accessibilityLabel={t("reader.toolbar.settingsAccessibility")}
              icon="typography"
              label={t("reader.toolbar.settings")}
              onPress={() => {
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
          </View>
        </Animated.View>
      ) : null}

      <ReadingSettingsSheet
        activeTab={overlay.kind === "settings" ? overlay.tab : lastSettingsTab}
        appearance={displayedAppearance}
        bottomInset={insets.bottom}
        fontFamilies={fontFamilies}
        hasBookFonts={Object.keys(opened.book.fontFamilies ?? {}).length > 0}
        layoutPreference={layoutPreference}
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
        onLayoutPreferenceChange={onLayoutPreferenceChange}
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
    bottom: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
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
    flex: 1,
    padding: 0,
  },
  topControls: {
    position: "absolute",
    zIndex: 20,
  },
  bottomControls: {
    position: "absolute",
    zIndex: 20,
  },
  controlGroup: {
    flexDirection: "column",
    gap: uiSpace.sm,
    pointerEvents: "box-none",
  },
});
