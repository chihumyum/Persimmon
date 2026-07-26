import type {
  ReaderLayoutMode,
  ReaderPageTurnAnimation,
  ReaderTheme,
} from "@persimmon/reader-skia";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
          bottom,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.accentStrong }]}>
            READING LAYOUT
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>阅读布局</Text>
        </View>
        <Pressable
          accessibilityLabel="关闭阅读布局"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={[styles.closeText, { color: theme.accentStrong }]}>
            完成
          </Text>
        </Pressable>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  animationCopy: {
    flex: 1,
    gap: 2,
  },
  animationGroup: {
    borderRadius: 13,
    gap: 3,
    padding: 3,
  },
  animationOption: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  closeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  layoutIcon: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -2,
    minHeight: 28,
  },
  layoutOption: {
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    minHeight: 106,
    paddingHorizontal: 8,
    paddingVertical: 11,
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
    gap: 9,
  },
  panel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 17,
    maxWidth: 360,
    padding: 16,
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
  radio: {
    alignItems: "center",
    borderRadius: 8,
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
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    marginTop: 1,
  },
});
