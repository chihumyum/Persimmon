import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
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
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AsyncSkia } from "../../components/async-skia";
import type {
  LibraryBookSummary,
  OpenedLibraryBook,
} from "../library/repository";
import type {
  ReaderAppearanceSettings,
  ReaderPageTurnAnimation,
  ReaderPageTurnTuning,
} from "../library/types";
import { navigationLabelsForPosition } from "../reader/navigation-path";
import { READER_UI_FONT_FAMILY } from "../reader/reader-ui-typography";
import { ToolbarBreadcrumbCarousel } from "../reader/toolbar-breadcrumb-carousel";
import { PageTurnTuningPanel } from "./page-turn-tuning-panel";
import { ReadingLayoutPanel } from "./reading-layout-panel";
import { ReadingStylePanel } from "./reading-style-panel";

const ReaderSurface = React.lazy(() => import("../reader/reader-surface"));

interface Viewport {
  readonly width: number;
  readonly height: number;
}

interface ReaderFrame extends Viewport {
  readonly layout: ReaderLayoutMode;
}

interface NavigationRow {
  readonly item: BookNavigationItem;
  readonly depth: number;
}

function flattenNavigation(
  items: readonly BookNavigationItem[],
  depth = 0,
): NavigationRow[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flattenNavigation(item.children ?? [], depth + 1),
  ]);
}

export interface ReaderScreenProps {
  readonly entry: LibraryBookSummary;
  readonly appearance: ReaderAppearanceSettings;
  readonly resolvedColorScheme: ResolvedReaderColorScheme;
  readonly layout: ReaderLayoutMode;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly pageTurnTuning: ReaderPageTurnTuning;
  readonly opened: OpenedLibraryBook;
  readonly onBack: () => void;
  readonly onAppearanceChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
  readonly onPageTurnAnimationChange: (
    animation: ReaderPageTurnAnimation,
  ) => void;
  readonly onPageTurnTuningChange: (tuning: ReaderPageTurnTuning) => void;
  readonly onProgress: (progress: ReaderProgress) => void;
}

export function ReaderScreen({
  entry,
  appearance,
  resolvedColorScheme,
  layout,
  pageTurnAnimation,
  pageTurnTuning,
  opened,
  onBack,
  onAppearanceChange,
  onLayoutChange,
  onPageTurnAnimationChange,
  onPageTurnTuningChange,
  onProgress,
}: ReaderScreenProps) {
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
  const [styleVisible, setStyleVisible] = useState(false);
  const [layoutVisible, setLayoutVisible] = useState(false);
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
      setLayoutVisible(false);
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
  const toolbarNavigationLabels = useMemo(() => {
    const labels = navigationLabelsForPosition(opened.book, currentPosition);
    if (labels.length > 0) {
      return labels;
    }
    const sectionTitle = currentPosition
      ? opened.book.sections
          .find((section) => section.id === currentPosition.sectionId)
          ?.title?.trim()
      : opened.book.sections[0]?.title?.trim();
    return [sectionTitle || opened.book.title];
  }, [currentPosition, opened.book]);
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
      setStyleVisible(false);
      setLayoutVisible(false);
      setTuningVisible(false);
    }
    setControlsVisible((visible) => !visible);
  }, [controlsVisible, turning]);
  const handleTurningChange = useCallback((nextTurning: boolean) => {
    setTurning(nextTurning);
    if (nextTurning) {
      setControlsVisible(false);
      setStyleVisible(false);
      setLayoutVisible(false);
      setTuningVisible(false);
      setTocVisible(false);
    }
  }, []);
  const handleSelectionChange = useCallback((nextSelecting: boolean) => {
    setSelecting(nextSelecting);
    if (nextSelecting) {
      setControlsVisible(false);
      setLayoutVisible(false);
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

      {!turning && !selecting && controlsVisible && toolbarHeaderEnabled ? (
        <View
          pointerEvents="none"
          style={[styles.toolbarHeaderRow, { top: insets.top + 8 }]}
        >
          <ToolbarBreadcrumbCarousel
            color={theme.controlText}
            labels={toolbarNavigationLabels}
          />
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.topControls, { top: insets.top + 8 }]}
        >
          <Pressable
            accessibilityLabel="返回书架"
            accessibilityRole="button"
            onPress={onBack}
            style={[
              styles.floatingButton,
              styles.backButton,
              {
                backgroundColor: theme.panel,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Text
              style={[styles.accentButtonText, { color: theme.accentStrong }]}
            >
              ‹ 书架
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="打开目录"
            accessibilityRole="button"
            disabled={navigationRows.length === 0}
            onPress={() => {
              setStyleVisible(false);
              setLayoutVisible(false);
              setTuningVisible(false);
              setTocVisible((visible) => !visible);
            }}
            style={[
              styles.floatingButton,
              {
                backgroundColor: theme.panel,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Text
              style={[styles.floatingButtonText, { color: theme.controlText }]}
            >
              目录
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.bottomControls, { bottom: insets.bottom + 8 }]}
        >
          <View pointerEvents="box-none" style={styles.controlGroup}>
            <Pressable
              accessibilityLabel="打开阅读布局"
              accessibilityRole="button"
              onPress={() => {
                setStyleVisible(false);
                setTuningVisible(false);
                setTocVisible(false);
                setLayoutVisible((visible) => !visible);
              }}
              style={[
                styles.floatingButton,
                styles.layoutButton,
                {
                  backgroundColor: theme.panel,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <Text
                style={[
                  styles.floatingButtonText,
                  { color: theme.controlText },
                ]}
              >
                布局
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="调节翻页常量"
              accessibilityRole="button"
              onPress={() => {
                setStyleVisible(false);
                setLayoutVisible(false);
                setTocVisible(false);
                setTuningVisible((visible) => !visible);
              }}
              style={[
                styles.floatingButton,
                {
                  backgroundColor: theme.panel,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <Text
                style={[
                  styles.floatingButtonText,
                  { color: theme.controlText },
                ]}
              >
                曲线
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="打开阅读样式"
              accessibilityRole="button"
              onPress={() => {
                setTuningVisible(false);
                setLayoutVisible(false);
                setTocVisible(false);
                setStyleVisible((visible) => !visible);
              }}
              style={[
                styles.floatingButton,
                {
                  backgroundColor: theme.panel,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <Text
                style={[styles.typeButtonText, { color: theme.controlText }]}
              >
                Aa
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible && tuningVisible ? (
        <PageTurnTuningPanel
          theme={theme}
          bottom={insets.bottom + 52}
          tuning={pageTurnTuning}
          onChange={onPageTurnTuningChange}
          onClose={() => setTuningVisible(false)}
        />
      ) : null}

      {!turning && !selecting && controlsVisible && layoutVisible ? (
        <ReadingLayoutPanel
          layout={layout}
          pageTurnAnimation={pageTurnAnimation}
          theme={theme}
          bottom={insets.bottom + 52}
          onAnimationChange={onPageTurnAnimationChange}
          onClose={() => setLayoutVisible(false)}
          onLayoutChange={handleLayoutChange}
        />
      ) : null}

      {!turning && controlsVisible && styleVisible ? (
        <ReadingStylePanel
          appearance={appearance}
          theme={theme}
          bottom={insets.bottom + 52}
          onChange={onAppearanceChange}
          onClose={() => setStyleVisible(false)}
        />
      ) : null}

      {tocVisible ? (
        <View
          style={[
            styles.tocPanel,
            {
              backgroundColor: theme.panel,
              paddingBottom: insets.bottom,
              paddingTop: insets.top,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={[styles.tocHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.tocTitle, { color: theme.text }]}>目录</Text>
            <Pressable
              accessibilityLabel="关闭目录"
              accessibilityRole="button"
              onPress={() => setTocVisible(false)}
            >
              <Text style={[styles.tocClose, { color: theme.accentStrong }]}>
                关闭
              </Text>
            </Pressable>
          </View>
          <ScrollView>
            {navigationRows.map(({ item, depth }) => (
              <Pressable
                key={item.id}
                accessibilityLabel={`跳转到 ${item.label}`}
                accessibilityRole="button"
                onPress={() => jumpTo(item.target)}
                style={[
                  styles.tocRow,
                  { borderBottomColor: theme.border },
                  { paddingLeft: 18 + Math.min(depth, 3) * 16 },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[styles.tocRowText, { color: theme.controlText }]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
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
    flexDirection: "row",
    left: Platform.OS === "web" ? 112 : 92,
    pointerEvents: "none",
    position: "absolute",
    right: Platform.OS === "web" ? 112 : 92,
    zIndex: 20,
  },
  controlGroup: {
    flexDirection: "row",
    gap: 7,
    pointerEvents: "box-none",
  },
  floatingButton: {
    alignItems: "center",
    backgroundColor: "rgba(251, 247, 240, 0.94)",
    borderColor: "rgba(91, 76, 65, 0.13)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    minWidth: 42,
    paddingHorizontal: 10,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 2px 9px rgba(61, 48, 38, 0.10)" }
      : {
          elevation: 2,
          shadowColor: "#3d3026",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
        }),
  },
  floatingButtonText: {
    color: "#6e6259",
    fontSize: 13,
    fontFamily: READER_UI_FONT_FAMILY,
    includeFontPadding: false,
    letterSpacing: 0.25,
    lineHeight: 18,
  },
  accentButtonText: {
    color: "#b94b24",
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 13,
    includeFontPadding: false,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  backButton: {
    paddingLeft: 9,
    paddingRight: 12,
  },
  layoutButton: {
    minWidth: 46,
  },
  tocClose: {
    color: "#b94b24",
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 14,
    includeFontPadding: false,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  tocHeader: {
    alignItems: "center",
    borderBottomColor: "#e4d8cb",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  tocPanel: {
    bottom: 0,
    left: 0,
    maxWidth: 390,
    position: "absolute",
    top: 0,
    width: "88%",
    zIndex: 30,
    ...(Platform.OS === "web"
      ? { boxShadow: "8px 0 24px rgba(61, 48, 38, 0.18)" }
      : {
          elevation: 12,
          shadowColor: "#3d3026",
          shadowOffset: { width: 8, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
        }),
  },
  tocRow: {
    borderBottomColor: "#eee5dc",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingRight: 16,
    paddingVertical: 13,
  },
  tocRowText: {
    color: "#4d443d",
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 14,
    includeFontPadding: false,
    letterSpacing: 0.15,
    lineHeight: 20,
  },
  tocTitle: {
    color: "#3e3731",
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 18,
    includeFontPadding: false,
    letterSpacing: 0.2,
    lineHeight: 25,
  },
  typeButtonText: {
    color: "#5c534b",
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 13,
    includeFontPadding: false,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
});
