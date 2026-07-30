import type {
  ReaderLayoutMode,
  ReaderPageTurnAnimation,
  ReaderTheme,
} from "@persimmon/reader-skia";
import { Pressable, StyleSheet, View } from "react-native";

import {
  ReaderFloatingPanel,
  ReaderPanelHeader,
} from "../components/reader-floating-panel";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";

interface ReadingLayoutPanelProps {
  readonly layout: ReaderLayoutMode;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly theme: ReaderTheme;
  readonly bottom: number;
  readonly onAnimationChange: (animation: ReaderPageTurnAnimation) => void;
  readonly onClose: () => void;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
}

const LAYOUT_OPTIONS: readonly {
  readonly value: ReaderLayoutMode;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}[] = [
  {
    value: "single",
    label: "单栏",
    description: "每屏显示一页",
    icon: "▯",
  },
  {
    value: "spread",
    label: "双栏",
    description: "每屏并排显示两页",
    icon: "▯ ▯",
  },
];

const ANIMATION_OPTIONS: readonly {
  readonly value: ReaderPageTurnAnimation;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: "natural",
    label: "自然翻页",
    description: "模拟纸张卷曲与落页",
  },
  {
    value: "none",
    label: "无动画",
    description: "立即切换到上一页或下一页",
  },
];

export function ReadingLayoutPanel({
  layout,
  pageTurnAnimation,
  theme,
  bottom,
  onAnimationChange,
  onClose,
  onLayoutChange,
}: ReadingLayoutPanelProps) {
  return (
    <ReaderFloatingPanel bottom={bottom} theme={theme} style={styles.panel}>
      <ReaderPanelHeader
        closeAccessibilityLabel="关闭阅读布局"
        eyebrow="阅读设置"
        theme={theme}
        title="阅读布局"
        onClose={onClose}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
          页面布局
        </Text>
        <View style={styles.optionRow}>
          {LAYOUT_OPTIONS.map((option) => {
            const selected = layout === option.value;
            return (
              <Pressable
                key={option.value}
                aria-checked={selected}
                accessibilityLabel={`${option.label}，${option.description}`}
                accessibilityRole="radio"
                onPress={() => onLayoutChange(option.value)}
                style={[
                  styles.layoutOption,
                  {
                    backgroundColor: selected
                      ? theme.panelRaised
                      : "transparent",
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.layoutIcon,
                    {
                      color: selected ? theme.accentStrong : theme.controlText,
                    },
                  ]}
                >
                  {option.icon}
                </Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: selected ? theme.accentStrong : theme.controlText,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: theme.secondaryText },
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
          翻页动画
        </Text>
        <View
          style={[styles.animationGroup, { backgroundColor: theme.panelMuted }]}
        >
          {ANIMATION_OPTIONS.map((option) => {
            const selected = pageTurnAnimation === option.value;
            return (
              <Pressable
                key={option.value}
                aria-checked={selected}
                accessibilityLabel={`${option.label}，${option.description}`}
                accessibilityRole="radio"
                onPress={() => onAnimationChange(option.value)}
                style={[
                  styles.animationOption,
                  {
                    backgroundColor: selected
                      ? theme.panelRaised
                      : "transparent",
                    borderColor: selected ? theme.accent : "transparent",
                  },
                ]}
              >
                <View style={styles.animationCopy}>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: selected
                          ? theme.accentStrong
                          : theme.controlText,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      { color: theme.secondaryText },
                    ]}
                  >
                    {option.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: selected
                        ? theme.accent
                        : theme.secondaryText,
                    },
                  ]}
                >
                  {selected ? (
                    <View
                      style={[
                        styles.radioDot,
                        { backgroundColor: theme.accent },
                      ]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ReaderFloatingPanel>
  );
}

const styles = StyleSheet.create({
  animationCopy: {
    flex: 1,
    gap: 2,
  },
  animationGroup: {
    borderRadius: uiRadius.card,
    gap: uiSpace.xxs + uiSpace.hairline,
    padding: uiSpace.xxs + uiSpace.hairline,
  },
  animationOption: {
    alignItems: "center",
    borderRadius: uiRadius.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: uiSpace.md,
    minHeight: 58,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.sm + uiSpace.hairline,
  },
  layoutIcon: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -2,
    minHeight: 28,
  },
  layoutOption: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: 1,
    flex: 1,
    minHeight: 106,
    paddingHorizontal: uiSpace.sm,
    paddingVertical: uiSpace.sm + uiSpace.xxs + uiSpace.hairline,
  },
  optionDescription: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: uiSpace.sm + uiSpace.hairline,
  },
  panel: {
    gap: uiSpace.lg + uiSpace.hairline,
  },
  radio: {
    alignItems: "center",
    borderRadius: uiRadius.small,
    borderWidth: 1.5,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  radioDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  section: {
    gap: uiSpace.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
