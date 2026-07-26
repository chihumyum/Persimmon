import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderLayoutMode, ReaderProgress } from "@persimmon/reader-skia";
import { READER_PAPER_COLOR } from "@persimmon/reader-skia/theme";
import React, { Suspense, useCallback, useMemo, useState } from "react";
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
import type { ReaderPageTurnTuning } from "../library/types";
import { PageTurnTuningPanel } from "./page-turn-tuning-panel";

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
  readonly fontSize: number;
  readonly layout: ReaderLayoutMode;
  readonly pageTurnTuning: ReaderPageTurnTuning;
  readonly opened: OpenedLibraryBook;
  readonly onBack: () => void;
  readonly onFontSizeChange: (fontSize: number) => void;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
  readonly onPageTurnTuningChange: (tuning: ReaderPageTurnTuning) => void;
  readonly onProgress: (progress: ReaderProgress) => void;
}

export function ReaderScreen({
  entry,
  fontSize,
  layout,
  pageTurnTuning,
  opened,
  onBack,
  onFontSizeChange,
  onLayoutChange,
  onPageTurnTuningChange,
  onProgress,
}: ReaderScreenProps) {
  const insets = useSafeAreaInsets();
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [tocVisible, setTocVisible] = useState(false);
  const [turning, setTurning] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
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
      setTuningVisible(false);
    }
    setControlsVisible((visible) => !visible);
  }, [controlsVisible, turning]);
  const handleTurningChange = useCallback((nextTurning: boolean) => {
    setTurning(nextTurning);
    if (nextTurning) {
      setControlsVisible(false);
      setTuningVisible(false);
      setTocVisible(false);
    }
  }, []);
  const handleSelectionChange = useCallback((nextSelecting: boolean) => {
    setSelecting(nextSelecting);
    if (nextSelecting) {
      setControlsVisible(false);
      setTuningVisible(false);
      setTocVisible(false);
    }
  }, []);

  return (
    <View style={styles.readerScreen}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="dark-content"
        translucent
      />

      <View style={styles.readerStage}>
        <View
          onLayout={measureReader}
          style={[
            styles.readerPage,
            layout === "spread" && styles.readerSpread,
          ]}
        >
          {viewport ? (
            <Suspense
              fallback={
                <View style={styles.readerLoading}>
                  <ActivityIndicator color="#d95f2b" />
                </View>
              }
            >
              <AsyncSkia>
                <ReaderSurface
                  key={`${opened.book.revisionId}:${readerGeneration}`}
                  book={opened.book}
                  width={viewport.width}
                  height={viewport.height}
                  fontSize={fontSize}
                  layout={layout}
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
              style={[styles.floatingButton, styles.backButton]}
            >
              <Text style={styles.accentButtonText}>‹ 书架</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="打开目录"
              accessibilityRole="button"
              disabled={navigationRows.length === 0}
              onPress={() => setTocVisible((visible) => !visible)}
              style={styles.floatingButton}
            >
              <Text style={styles.floatingButtonText}>目录</Text>
            </Pressable>
          </View>
          <View pointerEvents="box-none" style={styles.controlGroup}>
            <Pressable
              accessibilityLabel={
                layout === "single" ? "切换到双页布局" : "切换到单页布局"
              }
              accessibilityRole="button"
              onPress={() =>
                onLayoutChange(layout === "single" ? "spread" : "single")
              }
              style={[styles.floatingButton, styles.layoutButton]}
            >
              <Text style={styles.layoutButtonText}>
                {layout === "single" ? "▯" : "▯▯"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="调节翻页常量"
              accessibilityRole="button"
              onPress={() => setTuningVisible((visible) => !visible)}
              style={styles.floatingButton}
            >
              <Text style={styles.floatingButtonText}>曲线</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="减小字号"
              accessibilityRole="button"
              disabled={fontSize <= 16}
              onPress={() => onFontSizeChange(Math.max(16, fontSize - 2))}
              style={styles.floatingButton}
            >
              <Text style={styles.typeButtonText}>A−</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="增大字号"
              accessibilityRole="button"
              disabled={fontSize >= 30}
              onPress={() => onFontSizeChange(Math.min(30, fontSize + 2))}
              style={styles.floatingButton}
            >
              <Text style={styles.typeButtonText}>A+</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!turning && !selecting && controlsVisible && tuningVisible ? (
        <PageTurnTuningPanel
          top={insets.top + 52}
          tuning={pageTurnTuning}
          onChange={onPageTurnTuningChange}
          onClose={() => setTuningVisible(false)}
        />
      ) : null}

      {tocVisible ? (
        <View
          style={[
            styles.tocPanel,
            {
              paddingBottom: insets.bottom,
              paddingTop: insets.top,
            },
          ]}
        >
          <View style={styles.tocHeader}>
            <Text style={styles.tocTitle}>目录</Text>
            <Pressable
              accessibilityLabel="关闭目录"
              accessibilityRole="button"
              onPress={() => setTocVisible(false)}
            >
              <Text style={styles.tocClose}>关闭</Text>
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
                  { paddingLeft: 18 + Math.min(depth, 3) * 16 },
                ]}
              >
                <Text numberOfLines={2} style={styles.tocRowText}>
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
    backgroundColor: READER_PAPER_COLOR,
    flex: 1,
    justifyContent: "center",
  },
  readerPage: {
    backgroundColor: READER_PAPER_COLOR,
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
  layoutButtonText: {
    color: "#5c534b",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -4,
    paddingRight: 4,
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
    backgroundColor: READER_PAPER_COLOR,
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
