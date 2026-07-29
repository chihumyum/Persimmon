import type { BookNavigationItem, BookPosition } from "@persimmon/book-core";
import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { UiText as Text } from "../components/ui-text";
import { READER_UI_FONT_FAMILY } from "../reader/reader-ui-typography";

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
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
          shadowColor: theme.shadow,
          top,
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.accentStrong }]}>
            CONTENTS
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>目录</Text>
        </View>
        <Pressable
          accessibilityLabel="关闭目录"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={[styles.closeText, { color: theme.accentStrong }]}>
            完成
          </Text>
        </Pressable>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  closeText: {
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 13,
    fontWeight: "600",
  },
  eyebrow: {
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  panel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "72%",
    maxWidth: 380,
    padding: 12,
    position: "absolute",
    right: Platform.OS === "web" ? 30 : 12,
    width: "88%",
    zIndex: 26,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 8px 28px rgba(0, 0, 0, 0.22)" }
      : {
          elevation: 9,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
        }),
  },
  row: {
    alignItems: "center",
    borderRadius: 11,
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
    fontFamily: READER_UI_FONT_FAMILY,
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
  title: {
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 1,
  },
});
