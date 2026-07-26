import { useCallback, useMemo, useRef, useState } from "react";
import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";

import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
  type ReaderColorMode,
  type ReaderFontFamily,
  type ReaderProgressDisplay,
} from "../library/types";

interface ReadingStylePanelProps {
  readonly appearance: ReaderAppearanceSettings;
  readonly theme: ReaderTheme;
  readonly bottom: number;
  readonly onChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onClose: () => void;
}

interface StyleSliderProps {
  readonly formatValue: (value: number) => string;
  readonly label: string;
  readonly maximum: number;
  readonly minimum: number;
  readonly step: number;
  readonly value: number;
  readonly theme: ReaderTheme;
  readonly onChange: (value: number) => void;
}

function steppedValue(
  value: number,
  direction: 1 | -1,
  minimum: number,
  maximum: number,
  step: number,
): number {
  return Number(
    Math.min(maximum, Math.max(minimum, value + direction * step)).toFixed(3),
  );
}

function StyleSlider({
  formatValue,
  label,
  maximum,
  minimum,
  step,
  value,
  theme,
  onChange,
}: StyleSliderProps) {
  const trackWidth = useRef(1);
  const draftValueRef = useRef<number | undefined>(undefined);
  const [draftValue, setDraftValue] = useState<number | undefined>(undefined);
  const updateFromEvent = useCallback(
    (event: GestureResponderEvent) => {
      const ratio = Math.min(
        1,
        Math.max(0, event.nativeEvent.locationX / trackWidth.current),
      );
      const stepCount = Math.round((ratio * (maximum - minimum)) / step);
      const nextValue = Number(
        Math.min(
          maximum,
          Math.max(minimum, minimum + stepCount * step),
        ).toFixed(3),
      );
      draftValueRef.current = nextValue;
      setDraftValue(nextValue);
    },
    [maximum, minimum, step],
  );
  const commitDraft = useCallback(() => {
    const nextValue = draftValueRef.current;
    draftValueRef.current = undefined;
    setDraftValue(undefined);
    if (nextValue !== undefined && nextValue !== value) {
      onChange(nextValue);
    }
  }, [onChange, value]);
  const cancelDraft = useCallback(() => {
    draftValueRef.current = undefined;
    setDraftValue(undefined);
  }, []);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: updateFromEvent,
        onPanResponderMove: updateFromEvent,
        onPanResponderRelease: commitDraft,
        onPanResponderTerminate: cancelDraft,
        onPanResponderTerminationRequest: () => false,
      }),
    [cancelDraft, commitDraft, updateFromEvent],
  );
  const displayedValue = draftValue ?? value;
  const valueLabel = formatValue(displayedValue);
  const ratio = (displayedValue - minimum) / (maximum - minimum);
  const percentage = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  const adjust = useCallback(
    (direction: 1 | -1) =>
      onChange(steppedValue(value, direction, minimum, maximum, step)),
    [maximum, minimum, onChange, step, value],
  );

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderLabelRow}>
        <Text style={[styles.sliderLabel, { color: theme.controlText }]}>
          {label}
        </Text>
        <Text style={[styles.sliderValue, { color: theme.secondaryText }]}>
          {valueLabel}
        </Text>
      </View>
      <View style={styles.sliderControl}>
        <Pressable
          accessibilityLabel={`减小${label}`}
          accessibilityRole="button"
          disabled={value <= minimum}
          onPress={() => adjust(-1)}
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.panelRaised,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.stepButtonText, { color: theme.controlText }]}>
            −
          </Text>
        </Pressable>
        <View
          {...responder.panHandlers}
          aria-valuemax={maximum}
          aria-valuemin={minimum}
          aria-valuenow={displayedValue}
          aria-valuetext={valueLabel}
          accessibilityActions={[
            { name: "decrement", label: `减小${label}` },
            { name: "increment", label: `增大${label}` },
          ]}
          accessibilityLabel={label}
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: minimum,
            max: maximum,
            now: displayedValue,
            text: valueLabel,
          }}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") {
              adjust(1);
            } else if (event.nativeEvent.actionName === "decrement") {
              adjust(-1);
            }
          }}
          onLayout={(event: LayoutChangeEvent) => {
            trackWidth.current = Math.max(1, event.nativeEvent.layout.width);
          }}
          style={styles.sliderTouchTarget}
        >
          <View
            style={[styles.sliderRail, { backgroundColor: theme.panelMuted }]}
          >
            <View
              style={[
                styles.sliderFill,
                { backgroundColor: theme.accent, width: percentage },
              ]}
            />
          </View>
          <View
            style={[
              styles.sliderThumb,
              {
                backgroundColor: theme.paper,
                borderColor: theme.accent,
                left: percentage,
              },
            ]}
          />
        </View>
        <Pressable
          accessibilityLabel={`增大${label}`}
          accessibilityRole="button"
          disabled={value >= maximum}
          onPress={() => adjust(1)}
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.panelRaised,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.stepButtonText, { color: theme.controlText }]}>
            ＋
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const FONT_OPTIONS: readonly {
  readonly value: ReaderFontFamily;
  readonly label: string;
  readonly sample: string;
}[] = [
  { value: "serif", label: "衬线", sample: "柿子 Aa" },
  { value: "sans", label: "无衬线", sample: "柿子 Aa" },
];

const PROGRESS_OPTIONS: readonly {
  readonly value: ReaderProgressDisplay;
  readonly label: string;
}[] = [
  { value: "footer", label: "页脚" },
  { value: "header", label: "页眉" },
  { value: "both", label: "两处" },
  { value: "hidden", label: "隐藏" },
];

const COLOR_MODE_OPTIONS: readonly {
  readonly value: ReaderColorMode;
  readonly label: string;
}[] = [
  { value: "system", label: "自动" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

export function ReadingStylePanel({
  appearance,
  theme,
  bottom,
  onChange,
  onClose,
}: ReadingStylePanelProps) {
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const update = useCallback(
    <Key extends keyof ReaderAppearanceSettings>(
      key: Key,
      value: ReaderAppearanceSettings[Key],
    ) => {
      const next = { ...appearanceRef.current, [key]: value };
      appearanceRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
          shadowColor: theme.shadow,
          bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.accentStrong }]}>
            READING APPEARANCE
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>阅读样式</Text>
        </View>
        <Pressable
          accessibilityLabel="关闭阅读样式"
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
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator
        style={styles.settingsScroller}
      >
        <View style={styles.settingSection}>
          <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
            颜色模式
          </Text>
          <View
            style={[
              styles.progressOptions,
              { backgroundColor: theme.panelMuted },
            ]}
          >
            {COLOR_MODE_OPTIONS.map((option) => {
              const selected = appearance.colorMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  aria-checked={selected}
                  accessibilityLabel={`${option.label}颜色模式`}
                  accessibilityRole="radio"
                  onPress={() => update("colorMode", option.value)}
                  style={[
                    styles.progressOption,
                    selected && {
                      backgroundColor: theme.panelRaised,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: selected
                          ? theme.accentStrong
                          : theme.secondaryText,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
            阅读主题
          </Text>
          <View
            accessible
            accessibilityLabel="暖色纸张主题，已选择"
            accessibilityRole="radio"
            accessibilityState={{ checked: true }}
            aria-checked={true}
            style={[
              styles.themeOption,
              {
                backgroundColor: theme.panelRaised,
                borderColor: theme.accent,
              },
            ]}
          >
            <View style={styles.themePreview}>
              <View
                style={[styles.themeSwatch, { backgroundColor: "#fbf7f0" }]}
              />
              <View
                style={[styles.themeSwatch, { backgroundColor: "#1f1a17" }]}
              />
            </View>
            <View style={styles.themeCopy}>
              <Text style={[styles.optionLabel, { color: theme.accentStrong }]}>
                默认暖色
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  { color: theme.secondaryText },
                ]}
              >
                浅色与深色分别调校
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
            字体
          </Text>
          <View style={styles.optionRow}>
            {FONT_OPTIONS.map((option) => {
              const selected = appearance.fontFamily === option.value;
              return (
                <Pressable
                  key={option.value}
                  aria-checked={selected}
                  accessibilityLabel={`${option.label}字体`}
                  accessibilityRole="radio"
                  onPress={() => update("fontFamily", option.value)}
                  style={[
                    styles.fontOption,
                    {
                      backgroundColor: selected
                        ? theme.panelRaised
                        : "transparent",
                      borderColor: selected ? theme.accent : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSample,
                      option.value === "serif"
                        ? styles.serifSample
                        : styles.sansSample,
                      {
                        color: selected
                          ? theme.accentStrong
                          : theme.controlText,
                      },
                    ]}
                  >
                    {option.sample}
                  </Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: selected
                          ? theme.accentStrong
                          : theme.secondaryText,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <StyleSlider
          formatValue={(value) => `${value} px`}
          label="字号"
          maximum={32}
          minimum={16}
          step={1}
          theme={theme}
          value={appearance.fontSize}
          onChange={(value) => update("fontSize", value)}
        />
        <StyleSlider
          formatValue={(value) => `${value.toFixed(2)}×`}
          label="行距"
          maximum={2.1}
          minimum={1.25}
          step={0.05}
          theme={theme}
          value={appearance.lineHeight}
          onChange={(value) => update("lineHeight", value)}
        />
        <StyleSlider
          formatValue={(value) => `${value.toFixed(1)} em`}
          label="段落间距"
          maximum={2}
          minimum={0}
          step={0.1}
          theme={theme}
          value={appearance.paragraphSpacing}
          onChange={(value) => update("paragraphSpacing", value)}
        />
        <StyleSlider
          formatValue={(value) => `${value} px`}
          label="左右页边距"
          maximum={72}
          minimum={16}
          step={4}
          theme={theme}
          value={appearance.horizontalMargin}
          onChange={(value) => update("horizontalMargin", value)}
        />

        <View style={styles.settingSection}>
          <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
            阅读进度
          </Text>
          <View
            style={[
              styles.progressOptions,
              { backgroundColor: theme.panelMuted },
            ]}
          >
            {PROGRESS_OPTIONS.map((option) => {
              const selected = appearance.progressDisplay === option.value;
              return (
                <Pressable
                  key={option.value}
                  aria-checked={selected}
                  accessibilityLabel={`进度显示在${option.label}`}
                  accessibilityRole="radio"
                  onPress={() => update("progressDisplay", option.value)}
                  style={[
                    styles.progressOption,
                    selected && {
                      backgroundColor: theme.panelRaised,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: selected
                          ? theme.accentStrong
                          : theme.secondaryText,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Text style={[styles.footerHint, { color: theme.secondaryText }]}>
          调整后会从当前文字位置重新排版
        </Text>
        <Pressable
          accessibilityLabel="恢复默认阅读样式"
          accessibilityRole="button"
          onPress={() => onChange(DEFAULT_READER_APPEARANCE)}
        >
          <Text style={[styles.resetText, { color: theme.accentStrong }]}>
            恢复默认
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  closeText: {
    color: "#b94b24",
    fontSize: 13,
    fontWeight: "600",
  },
  eyebrow: {
    color: "#b94b24",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  fontOption: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  fontSample: {
    color: "#524941",
    fontSize: 18,
  },
  footer: {
    alignItems: "center",
    borderTopColor: "#e7ddd3",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingTop: 9,
  },
  footerHint: {
    color: "#92867c",
    flex: 1,
    fontSize: 10,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  optionLabel: {
    color: "#81756b",
    fontSize: 11,
    fontWeight: "600",
  },
  optionDescription: {
    fontSize: 10,
    lineHeight: 14,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionSelected: {
    backgroundColor: "#fffaf4",
    borderColor: "#d95f2b",
  },
  optionTextSelected: {
    color: "#a94420",
  },
  panel: {
    backgroundColor: "rgba(251, 247, 240, 0.99)",
    borderColor: "rgba(91, 76, 65, 0.14)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "84%",
    maxWidth: 360,
    padding: 16,
    position: "absolute",
    right: Platform.OS === "web" ? 30 : 12,
    width: "88%",
    zIndex: 26,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 8px 28px rgba(61, 48, 38, 0.18)" }
      : {
          elevation: 9,
          shadowColor: "#3d3026",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
        }),
  },
  progressOption: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  progressOptions: {
    backgroundColor: "#eee5dc",
    borderRadius: 11,
    flexDirection: "row",
    gap: 2,
    padding: 2,
  },
  resetText: {
    color: "#b94b24",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 4,
  },
  sansSample: {
    fontFamily: Platform.select({
      android: "sans-serif",
      default: "Arial",
      ios: "System",
    }),
  },
  sectionLabel: {
    color: "#6e6259",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  serifSample: {
    fontFamily: Platform.select({
      android: "serif",
      default: "Georgia",
      ios: "Times New Roman",
    }),
  },
  settingSection: {
    gap: 6,
  },
  settingsList: {
    gap: 11,
    paddingRight: 3,
  },
  settingsScroller: {
    flexShrink: 1,
  },
  sliderControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  sliderFill: {
    backgroundColor: "#d95f2b",
    borderRadius: 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  sliderLabel: {
    color: "#5c534b",
    fontSize: 12,
    fontWeight: "600",
  },
  sliderLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderRail: {
    backgroundColor: "#ddd2c7",
    borderRadius: 2,
    height: 4,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 12,
  },
  sliderRow: {
    gap: 1,
  },
  sliderThumb: {
    backgroundColor: "#fbf7f0",
    borderColor: "#d95f2b",
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    marginLeft: -7,
    position: "absolute",
    top: 7,
    width: 14,
  },
  sliderTouchTarget: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  sliderValue: {
    color: "#8a7d72",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  stepButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  stepButtonText: {
    color: "#b94b24",
    fontSize: 18,
    fontWeight: "600",
  },
  themeCopy: {
    flex: 1,
    gap: 2,
  },
  themeOption: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  themePreview: {
    flexDirection: "row",
  },
  themeSwatch: {
    borderColor: "rgba(127, 109, 94, 0.28)",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 20,
    marginRight: -4,
    width: 20,
  },
  title: {
    color: "#3e3731",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 1,
  },
});
