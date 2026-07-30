import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

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
  readonly currentPosition?: BookPosition;
  readonly rows: readonly NavigationRow[];
  readonly theme: ReaderTheme;
  readonly top: number;
  readonly onClose: () => void;
  readonly onSelect: (position: BookPosition) => void;
}

export function TableOfContentsPanel({
  currentPosition,
  rows,
  theme,
  top,
  onClose,
  onSelect,
}: TableOfContentsPanelProps) {
  return (
    <ReaderFloatingPanel
      maxHeight="72%"
      maxWidth={380}
      padding={uiSpace.md}
      theme={theme}
      top={top}
    >
      <ReaderPanelHeader
        closeAccessibilityLabel="关闭目录"
        eyebrow="本书导航"
        theme={theme}
        title="目录"
        style={styles.header}
        onClose={onClose}
      />
      <ScrollView
        contentContainerStyle={styles.rows}
        showsVerticalScrollIndicator={false}
      >
        {rows.map(({ item, depth }) => {
          const selected =
            currentPosition?.sectionId === item.target.sectionId &&
            (currentPosition.blockId === item.target.blockId || depth === 0);
          return (
            <Pressable
              accessibilityLabel={`跳转到 ${item.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={item.id}
              onPress={() => onSelect(item.target)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selected ? theme.panelRaised : "transparent",
                  paddingLeft: 12 + Math.min(depth, 4) * 15,
                },
                pressed && { backgroundColor: theme.panelMuted },
              ]}
            >
              <View
                style={[
                  styles.selectionMarker,
                  {
                    backgroundColor: selected ? theme.accent : "transparent",
                  },
                ]}
              />
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
  selectionMarker: {
    borderRadius: 2,
    height: 18,
    marginRight: 9,
    width: 3,
  },
});
