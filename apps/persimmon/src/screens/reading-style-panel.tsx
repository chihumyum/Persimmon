import {
  BUILTIN_READER_MATH_ID,
  type FontFamilyRecord,
} from "@persimmon/font-core";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  Alert,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";

import { UiIcon } from "../components/ui-icon";
import {
  ReaderFloatingPanel,
  ReaderPanelHeader,
} from "../components/reader-floating-panel";
import { UiSegmentedControl } from "../components/ui-segmented-control";
import { UiText as Text } from "../components/ui-text";
import { uiSpace } from "../components/ui-tokens";
import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
  type ReaderColorMode,
  type ReaderProgressDisplay,
} from "../library/types";
import { DOWNLOADABLE_FONT_CATALOG } from "../fonts/downloadable-font-catalog";

interface ReadingStylePanelProps {
  readonly appearance: ReaderAppearanceSettings;
  readonly fontFamilies: readonly FontFamilyRecord[];
  readonly hasBookFonts?: boolean;
  readonly theme: ReaderTheme;
  readonly bottom: number;
  readonly onChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onClose: () => void;
  readonly onDownloadFont: (familyId: string) => Promise<string>;
  readonly onImportFont: () => Promise<string | undefined>;
  readonly onRemoveFont: (familyId: string) => Promise<void>;
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
          <UiIcon color={theme.controlText} name="minus" size={16} />
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
          <UiIcon color={theme.controlText} name="add" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

const PROGRESS_OPTIONS: readonly {
  readonly value: ReaderProgressDisplay;
  readonly label: string;
  readonly accessibilityLabel: string;
}[] = [
  { value: "footer", label: "页脚", accessibilityLabel: "进度显示在页脚" },
  { value: "header", label: "页眉", accessibilityLabel: "进度显示在页眉" },
  { value: "both", label: "两处", accessibilityLabel: "进度显示在两处" },
  { value: "hidden", label: "隐藏", accessibilityLabel: "隐藏阅读进度" },
];

const COLOR_MODE_OPTIONS: readonly {
  readonly value: ReaderColorMode;
  readonly label: string;
  readonly accessibilityLabel: string;
}[] = [
  { value: "system", label: "自动", accessibilityLabel: "自动颜色模式" },
  { value: "light", label: "浅色", accessibilityLabel: "浅色模式" },
  { value: "dark", label: "深色", accessibilityLabel: "深色模式" },
];

export function ReadingStylePanel({
  appearance,
  fontFamilies,
  hasBookFonts = false,
  theme,
  bottom,
  onChange,
  onClose,
  onDownloadFont,
  onImportFont,
  onRemoveFont,
}: ReadingStylePanelProps) {
  const [fontBusy, setFontBusy] = useState(false);
  const [fontError, setFontError] = useState<string | undefined>();
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
  const chooseFont = useCallback(
    (selectedFontId: string) => {
      update("font", {
        ...appearanceRef.current.font,
        selectedFontId,
      });
    },
    [update],
  );
  const importFont = useCallback(async () => {
    setFontBusy(true);
    setFontError(undefined);
    try {
      const familyId = await onImportFont();
      if (familyId) {
        chooseFont(familyId);
      }
    } catch (error) {
      setFontError(error instanceof Error ? error.message : "字体导入失败。");
    } finally {
      setFontBusy(false);
    }
  }, [chooseFont, onImportFont]);
  const downloadFont = useCallback(
    async (familyId: string) => {
      setFontBusy(true);
      setFontError(undefined);
      try {
        chooseFont(await onDownloadFont(familyId));
      } catch (error) {
        setFontError(error instanceof Error ? error.message : "字体下载失败。");
      } finally {
        setFontBusy(false);
      }
    },
    [chooseFont, onDownloadFont],
  );
  const removeFont = useCallback(
    (family: FontFamilyRecord) => {
      const remove = async () => {
        setFontBusy(true);
        setFontError(undefined);
        try {
          await onRemoveFont(family.id);
        } catch (error) {
          setFontError(
            error instanceof Error ? error.message : "字体删除失败。",
          );
        } finally {
          setFontBusy(false);
        }
      };
      if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
        if (globalThis.confirm(`确定删除字体“${family.displayName}”吗？`)) {
          void remove();
        }
        return;
      }
      Alert.alert("删除字体", `确定删除“${family.displayName}”吗？`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: () => void remove() },
      ]);
    },
    [onRemoveFont],
  );
  const selectableFonts = useMemo(
    () => fontFamilies.filter((family) => family.id !== BUILTIN_READER_MATH_ID),
    [fontFamilies],
  );
  const selectedFontAvailable = selectableFonts.some(
    (family) => family.id === appearance.font.selectedFontId,
  );

  return (
    <ReaderFloatingPanel bottom={bottom} theme={theme} style={styles.panel}>
      <ReaderPanelHeader
        closeAccessibilityLabel="关闭阅读样式"
        eyebrow="阅读设置"
        theme={theme}
        title="阅读样式"
        style={styles.header}
        onClose={onClose}
      />

      <ScrollView
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator
        style={styles.settingsScroller}
      >
        <View style={styles.settingSection}>
          <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
            颜色模式
          </Text>
          <UiSegmentedControl
            accessibilityLabel="阅读颜色模式"
            options={COLOR_MODE_OPTIONS}
            theme={theme}
            value={appearance.colorMode}
            onChange={(value) => update("colorMode", value)}
          />
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
          {!selectedFontAvailable ? (
            <Text style={[styles.fontError, { color: theme.accentStrong }]}>
              此设备缺少所选字体，阅读正文暂时回退到 Noto Serif
              SC；字体设置已保留。
            </Text>
          ) : null}
          <View style={[styles.fontList, { borderColor: theme.border }]}>
            {selectableFonts.map((family) => {
              const selected = appearance.font.selectedFontId === family.id;
              return (
                <View
                  key={family.id}
                  style={[
                    styles.fontRow,
                    {
                      backgroundColor: selected
                        ? theme.panelRaised
                        : "transparent",
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <Pressable
                    aria-checked={selected}
                    accessibilityLabel={`${family.displayName}字体`}
                    accessibilityRole="radio"
                    disabled={fontBusy}
                    onPress={() => chooseFont(family.id)}
                    style={styles.fontChoice}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.fontName,
                        {
                          color: selected
                            ? theme.accentStrong
                            : theme.controlText,
                        },
                      ]}
                    >
                      {family.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.fontSource,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {family.source === "bundled"
                        ? "内置"
                        : family.source === "downloaded"
                          ? "已下载"
                          : "本地导入"}
                    </Text>
                  </Pressable>
                  {family.source !== "bundled" ? (
                    <Pressable
                      accessibilityLabel={`删除字体 ${family.displayName}`}
                      accessibilityRole="button"
                      disabled={fontBusy}
                      onPress={() => removeFont(family)}
                      style={styles.fontDelete}
                    >
                      <Text
                        style={[
                          styles.fontDeleteText,
                          { color: theme.accentStrong },
                        ]}
                      >
                        删除
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
          <Pressable
            accessibilityLabel="从本地文件导入字体"
            accessibilityRole="button"
            disabled={fontBusy}
            onPress={() => void importFont()}
            style={[
              styles.importFontButton,
              {
                backgroundColor: theme.panelRaised,
                borderColor: theme.border,
                opacity: fontBusy ? 0.55 : 1,
              },
            ]}
          >
            <Text
              style={[styles.importFontText, { color: theme.accentStrong }]}
            >
              {fontBusy ? "正在处理…" : "从本地导入 TTF / OTF"}
            </Text>
          </Pressable>
          {fontError ? (
            <Text style={[styles.fontError, { color: theme.accentStrong }]}>
              {fontError}
            </Text>
          ) : null}
          <Text style={[styles.fontCatalogLabel, { color: theme.controlText }]}>
            可下载字体
          </Text>
          <View style={[styles.fontList, { borderColor: theme.border }]}>
            {DOWNLOADABLE_FONT_CATALOG.families.map((family) => {
              const installed = fontFamilies.some(
                (candidate) => candidate.id === family.id,
              );
              return (
                <View
                  key={family.id}
                  style={[
                    styles.downloadRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={styles.downloadCopy}>
                    <Text
                      style={[styles.fontName, { color: theme.controlText }]}
                    >
                      {family.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {family.description}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`${installed ? "使用" : "下载"}字体 ${family.displayName}`}
                    accessibilityRole="button"
                    disabled={fontBusy}
                    onPress={() =>
                      installed
                        ? chooseFont(family.id)
                        : void downloadFont(family.id)
                    }
                    style={[
                      styles.downloadButton,
                      {
                        backgroundColor: theme.panelRaised,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.downloadButtonText,
                        { color: theme.accentStrong },
                      ]}
                    >
                      {installed ? "使用" : "下载"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.settingSection}>
          <View style={styles.bookFontRow}>
            <View style={styles.bookFontCopy}>
              <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
                使用书籍内嵌字体
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  { color: theme.secondaryText },
                ]}
              >
                {hasBookFonts
                  ? "仅应用在 EPUB 明确指定字体的位置"
                  : "这本书没有可用的内嵌字体"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="使用书籍内嵌字体"
              disabled={!hasBookFonts}
              onValueChange={(useBookEmbeddedFonts) =>
                update("font", {
                  ...appearanceRef.current.font,
                  useBookEmbeddedFonts,
                })
              }
              trackColor={{
                false: theme.panelMuted,
                true: theme.accent,
              }}
              value={hasBookFonts && appearance.font.useBookEmbeddedFonts}
            />
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
          <UiSegmentedControl
            accessibilityLabel="阅读进度显示位置"
            options={PROGRESS_OPTIONS}
            theme={theme}
            value={appearance.progressDisplay}
            onChange={(value) => update("progressDisplay", value)}
          />
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
    </ReaderFloatingPanel>
  );
}

const styles = StyleSheet.create({
  bookFontCopy: {
    flex: 1,
    gap: 3,
  },
  bookFontRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  fontChoice: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  downloadButton: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  downloadButtonText: {
    fontSize: 10,
    fontWeight: "600",
  },
  downloadCopy: {
    flex: 1,
    gap: 2,
  },
  downloadRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fontDelete: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  fontDeleteText: {
    fontSize: 11,
    fontWeight: "600",
  },
  fontError: {
    fontSize: 10,
    lineHeight: 14,
  },
  fontCatalogLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  fontList: {
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fontName: {
    fontSize: 13,
    fontWeight: "600",
  },
  fontRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  fontSource: {
    fontSize: 9,
  },
  importFontButton: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  importFontText: {
    fontSize: 11,
    fontWeight: "600",
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
    marginBottom: uiSpace.sm,
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
  optionSelected: {
    backgroundColor: "#fffaf4",
    borderColor: "#d95f2b",
  },
  optionTextSelected: {
    color: "#a94420",
  },
  panel: {
    maxHeight: "84%",
  },
  resetText: {
    color: "#b94b24",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 4,
  },
  sectionLabel: {
    color: "#6e6259",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
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
