import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderLayoutMode, ReaderProgress } from "@persimmon/reader-skia";
import { resolveReaderTheme } from "@persimmon/reader-skia/theme";
import React, { Suspense, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
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
import { PageTurnTuningPanel } from "./page-turn-tuning-panel";
import { ReadingLayoutPanel } from "./reading-layout-panel";
import { ReadingStylePanel } from "./reading-style-panel";

const ReaderSurface = React.lazy(() => import("../reader/reader-surface"));

interface Viewport {
  readonly width: number;
  readonly height: number;
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
  const systemColorScheme = useColorScheme();
  const resolvedColorScheme =
    appearance.colorMode === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : appearance.colorMode;
  const theme = useMemo(
    () => resolveReaderTheme(appearance.theme, resolvedColorScheme),
    [appearance.theme, resolvedColorScheme],
  );
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [tocVisible, setTocVisible] = useState(false);
  const [turning, setTurning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [styleVisible, setStyleVisible] = useState(false);
  const [layoutVisible, setLayoutVisible] = useState(false);
  const [tuningVisible, setTuningVisible] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<
    BookPosition | undefined
  >();
  const [readerGeneration, setReaderGeneration] = useState(0);
  const navigationRows = useMemo(
    () => flattenNavigation(opened.book.navigation ?? []),
    [opened.book.navigation],
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

  const jumpTo = useCallback((position: BookPosition) => {
    setNavigationTarget(position);
    setReaderGeneration((current) => current + 1);
    setTocVisible(false);
  }, []);
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
          {viewport ? (
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
                  key={`${opened.book.revisionId}:${readerGeneration}`}
                  book={opened.book}
                  width={viewport.width}
                  height={viewport.height}
                  appearance={appearance}
                  layout={layout}
                  pageTurnAnimation={pageTurnAnimation}
                  theme={theme}
                  topInset={insets.top}
                  bottomInset={insets.bottom}
                  progressHeaderVisible={!controlsVisible}
                  automaticPageTurnTuning={pageTurnTuning.click}
                  gesturePageTurnTuning={pageTurnTuning.gesture}
                  initialPosition={navigationTarget ?? entry.locator?.position}
                  loadResource={loadResource}
                  onCenterPress={handleCenterPress}
                  onProgress={onProgress}
                  onSelectionChange={handleSelectionChange}
                  onTurningChange={handleTurningChange}
                />
              </AsyncSkia>
            </Suspense>
          ) : null}
        </View>
      </View>

      {!turning && !selecting && controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.floatingControls, { top: insets.top + 8 }]}
        >
          <View pointerEvents="box-none" style={styles.controlGroup}>
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
                style={[
                  styles.floatingButtonText,
                  { color: theme.controlText },
                ]}
              >
                目录
              </Text>
            </Pressable>
          </View>
          <View pointerEvents="box-none" style={styles.controlGroup}>
            <Pressable
              accessibilityLabel="打开阅读布局"
              accessibilityRole="button"
              onPress={() => {
                setStyleVisible(false);
                setTuningVisible(false);
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
            {pageTurnAnimation === "natural" ? (
              <Pressable
                accessibilityLabel="调节翻页常量"
                accessibilityRole="button"
                onPress={() => {
                  setStyleVisible(false);
                  setLayoutVisible(false);
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
            ) : null}
            <Pressable
              accessibilityLabel="打开阅读样式"
              accessibilityRole="button"
              onPress={() => {
                setTuningVisible(false);
                setLayoutVisible(false);
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
          top={insets.top + 52}
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
          top={insets.top + 52}
          onAnimationChange={onPageTurnAnimationChange}
          onClose={() => setLayoutVisible(false)}
          onLayoutChange={onLayoutChange}
        />
      ) : null}

      {!turning && controlsVisible && styleVisible ? (
        <ReadingStylePanel
          appearance={appearance}
          theme={theme}
          top={insets.top + 52}
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
  floatingControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    left: Platform.OS === "web" ? 30 : 12,
    pointerEvents: "box-none",
    position: "absolute",
    right: Platform.OS === "web" ? 30 : 12,
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
    fontWeight: "600",
  },
  accentButtonText: {
    color: "#b94b24",
    fontSize: 14,
    fontWeight: "600",
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
    fontSize: 14,
    fontWeight: "600",
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
    fontSize: 14,
    lineHeight: 20,
  },
  tocTitle: {
    color: "#3e3731",
    fontSize: 18,
    fontWeight: "700",
  },
  typeButtonText: {
    color: "#5c534b",
    fontSize: 14,
    fontWeight: "700",
  },
});
