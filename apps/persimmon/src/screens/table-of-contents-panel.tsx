import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { useCallback, useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  ReaderFloatingPanel,
  ReaderPanelHeader,
} from "../components/reader-floating-panel";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";

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
  readonly rows: readonly NavigationRow[];
  readonly theme: ReaderTheme;
  readonly top: number;
  readonly onClose: () => void;
  readonly onSelect: (position: BookPosition) => void;
}

export function TableOfContentsPanel({
  currentItemId,
  rows,
  theme,
  top,
  onClose,
  onSelect,
}: TableOfContentsPanelProps) {
  const { t } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const viewportHeightRef = useRef(0);
  const rowLayoutsRef = useRef(
    new Map<string, { readonly y: number; readonly height: number }>(),
  );
  const scrolledItemIdRef = useRef<string | undefined>(undefined);
  const scrollToCurrent = useCallback(() => {
    if (!currentItemId || scrolledItemIdRef.current === currentItemId) {
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
    scrolledItemIdRef.current = undefined;
    scrollToCurrent();
  }, [currentItemId, scrollToCurrent]);

  return (
    <ReaderFloatingPanel
      maxHeight="72%"
      maxWidth={380}
      padding={uiSpace.md}
      theme={theme}
      top={top}
    >
      <ReaderPanelHeader
        closeAccessibilityLabel={t("reader.toc.closeAccessibility")}
        theme={theme}
        title={t("reader.toc.title")}
        style={styles.header}
        onClose={onClose}
      />
      <ScrollView
        contentContainerStyle={styles.rows}
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
                  backgroundColor: selected ? theme.panelRaised : "transparent",
                  paddingLeft: 12 + Math.min(depth, 6) * 19,
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
    </ReaderFloatingPanel>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: uiSpace.sm + uiSpace.xxs,
    paddingHorizontal: uiSpace.xs,
  },
  row: {
    alignItems: "center",
    borderRadius: uiRadius.control,
    flexDirection: "row",
    minHeight: 46,
    paddingRight: 10,
    paddingVertical: 8,
  },
  rows: {
    paddingBottom: 3,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    includeFontPadding: false,
    letterSpacing: 0.1,
    lineHeight: 19,
  },
});
