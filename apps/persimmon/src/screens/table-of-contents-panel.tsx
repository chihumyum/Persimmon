import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ReaderBottomSheet } from "../components/reader-bottom-sheet";
import { ReaderPanelHeader } from "../components/reader-floating-panel";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSize, uiSpace } from "../components/ui-tokens";

const TOC_SNAP_POINTS: (string | number)[] = ["92%"];

export interface NavigationRow {
  readonly item: BookNavigationItem;
  readonly depth: number;
}

export function flattenNavigation(
  items: readonly BookNavigationItem[],
  depth = 0,
): NavigationRow[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flattenNavigation(item.children ?? [], depth + 1),
  ]);
}

export interface TableOfContentsPanelProps {
  readonly currentItemId?: string;
  readonly bottomInset: number;
  readonly rows: readonly NavigationRow[];
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSelect: (position: BookPosition) => void;
}

export function TableOfContentsPanel({
  currentItemId,
  bottomInset,
  rows,
  theme,
  visible,
  onClose,
  onSelect,
}: TableOfContentsPanelProps) {
  const { t } = useTranslation();
  const [sheetVisible, setSheetVisible] = useState(visible);
  const scrollViewRef = useRef<ScrollView>(null);
  const viewportHeightRef = useRef(0);
  const visibleRef = useRef(sheetVisible);
  visibleRef.current = sheetVisible;
  const rowLayoutsRef = useRef(
    new Map<string, { readonly y: number; readonly height: number }>(),
  );
  const scrolledItemIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    setSheetVisible(visible);
  }, [visible]);
  const scrollToCurrent = useCallback(() => {
    if (
      !visibleRef.current ||
      !currentItemId ||
      scrolledItemIdRef.current === currentItemId
    ) {
      return;
    }
    const row = rowLayoutsRef.current.get(currentItemId);
    const viewportHeight = viewportHeightRef.current;
    if (!row || viewportHeight <= 0) {
      return;
    }
    scrolledItemIdRef.current = currentItemId;
    scrollViewRef.current?.scrollTo({
      animated: false,
      y: Math.max(0, row.y - (viewportHeight - row.height) / 2),
    });
  }, [currentItemId]);
  useEffect(() => {
    if (!sheetVisible) {
      return;
    }
    scrolledItemIdRef.current = undefined;
    scrollToCurrent();
  }, [currentItemId, scrollToCurrent, sheetVisible]);

  return (
    <ReaderBottomSheet
      snapPoints={TOC_SNAP_POINTS}
      testID="reader-toc-sheet"
      theme={theme}
      visible={sheetVisible}
      onDismiss={onClose}
    >
      <View style={styles.sheetPage}>
        <ReaderPanelHeader
          centerTitle
          closeAccessibilityLabel={t("reader.toc.closeAccessibility")}
          theme={theme}
          title={t("reader.toc.title")}
          style={[styles.header, { borderBottomColor: theme.border }]}
          onClose={() => setSheetVisible(false)}
        />
        <ScrollView
          contentContainerStyle={[
            styles.rows,
            { paddingBottom: bottomInset + uiSpace.xxl },
          ]}
          onContentSizeChange={scrollToCurrent}
          onLayout={(event: LayoutChangeEvent) => {
            viewportHeightRef.current = event.nativeEvent.layout.height;
            scrollToCurrent();
          }}
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
        >
          {rows.map(({ item, depth }) => {
            const selected = currentItemId === item.id;
            return (
              <Pressable
                accessibilityLabel={t("reader.toc.jumpAccessibility", {
                  label: item.label,
                })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.id}
                onLayout={(event: LayoutChangeEvent) => {
                  const { y, height } = event.nativeEvent.layout;
                  rowLayoutsRef.current.set(item.id, { y, height });
                  if (selected) {
                    scrollToCurrent();
                  }
                }}
                onPress={() => onSelect(item.target)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: selected
                      ? `${theme.accent}14`
                      : "transparent",
                    paddingLeft: 16 + Math.min(depth, 6) * 19,
                  },
                  pressed && { backgroundColor: theme.panelMuted },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    styles.rowText,
                    {
                      color: selected ? theme.accentStrong : theme.controlText,
                      fontWeight: selected ? "700" : "500",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </ReaderBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: uiSize.sheetHeader,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  row: {
    alignItems: "center",
    borderRadius: uiRadius.control,
    flexDirection: "row",
    minHeight: 58,
    paddingRight: 10,
    paddingVertical: 8,
  },
  rows: {
    paddingHorizontal: uiSpace.md,
    paddingTop: uiSpace.sm,
  },
  rowText: {
    flex: 1,
    fontSize: 17,
    includeFontPadding: false,
    letterSpacing: 0.1,
    lineHeight: 24,
  },
  sheetPage: {
    flex: 1,
  },
});
