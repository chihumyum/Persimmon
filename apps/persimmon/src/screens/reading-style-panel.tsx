import {
  BUILTIN_READER_MATH_ID,
  type FontFamilyRecord,
} from "@persimmon/font-core";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type ReaderLayoutMode,
  type ReaderPageTurnAnimation,
  type ReaderTheme,
} from "@persimmon/reader-skia";
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useTranslation } from "react-i18next";

import { UiButton } from "../components/ui-button";
import { UiIcon } from "../components/ui-icon";
import { ReaderFloatingPanel } from "../components/reader-floating-panel";
import { ReaderThemeSelector } from "../components/reader-theme-selector";
import { UiSegmentedControl } from "../components/ui-segmented-control";
import { UiText as Text } from "../components/ui-text";
import { uiSpace } from "../components/ui-tokens";
import { translate } from "../i18n";
import {
  type ReaderAppearanceSettings,
  type ReaderColorMode,
  type ReaderProgressDisplay,
} from "../library/types";
import {
  resetPageAppearance,
  resetTextAppearance,
} from "../reader/reader-settings-category";
import {
  readerSliderRatioAtPageX,
  readerSliderTrackMetrics,
  readerSliderValueAtPageX,
  READER_SLIDER_THUMB_SIZE,
  stepReaderSliderValue,
  type ReaderSliderTrackMetrics,
} from "../reader/reader-slider-model";
import { DOWNLOADABLE_FONT_CATALOG } from "../fonts/downloadable-font-catalog";
import { ReadingPageSettings } from "./reading-layout-panel";

interface ReadingSettingsPanelProps {
  readonly appearance: ReaderAppearanceSettings;
  readonly fontFamilies: readonly FontFamilyRecord[];
  readonly hasBookFonts?: boolean;
  readonly layout: ReaderLayoutMode;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly theme: ReaderTheme;
  readonly bottom: number;
  readonly onAnimationChange: (animation: ReaderPageTurnAnimation) => void;
  readonly onChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onClose: () => void;
  readonly onDownloadFont: (familyId: string) => Promise<string>;
  readonly onImportFont: () => Promise<string | undefined>;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
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
  const { t } = useTranslation();
  const sliderRef = useRef<View>(null);
  const trackMetricsRef = useRef<ReaderSliderTrackMetrics | undefined>(
    undefined,
  );
  const draftValueRef = useRef<number | undefined>(undefined);
  const [draftRatio, setDraftRatio] = useState<number | undefined>(undefined);
  const [draftValue, setDraftValue] = useState<number | undefined>(undefined);
  const updateFromPageX = useCallback(
    (pageX: number, metrics = trackMetricsRef.current) => {
      if (!metrics) {
        return;
      }
      const nextValue = readerSliderValueAtPageX(
        pageX,
        metrics,
        minimum,
        maximum,
        step,
      );
      draftValueRef.current = nextValue;
      setDraftRatio(readerSliderRatioAtPageX(pageX, metrics));
      setDraftValue(nextValue);
    },
    [maximum, minimum, step],
  );
  const measureTrack = useCallback(
    (pageX?: number) => {
      sliderRef.current?.measureInWindow((frameLeft, _top, frameWidth) => {
        const metrics = readerSliderTrackMetrics(frameLeft, frameWidth);
        trackMetricsRef.current = metrics;
        if (pageX !== undefined) {
          updateFromPageX(pageX, metrics);
        }
      });
    },
    [updateFromPageX],
  );
  const beginGesture = useCallback(
    (event: GestureResponderEvent) => {
      measureTrack(event.nativeEvent.pageX);
    },
    [measureTrack],
  );
  const commitDraft = useCallback(() => {
    const nextValue = draftValueRef.current;
    draftValueRef.current = undefined;
    setDraftRatio(undefined);
    setDraftValue(undefined);
    if (nextValue !== undefined && nextValue !== value) {
      onChange(nextValue);
    }
  }, [onChange, value]);
  const cancelDraft = useCallback(() => {
    draftValueRef.current = undefined;
    setDraftRatio(undefined);
    setDraftValue(undefined);
  }, []);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: beginGesture,
        onPanResponderMove: (event) => updateFromPageX(event.nativeEvent.pageX),
        onPanResponderRelease: (event) => {
          updateFromPageX(event.nativeEvent.pageX);
          commitDraft();
        },
        onPanResponderTerminate: cancelDraft,
        onPanResponderTerminationRequest: () => false,
      }),
    [beginGesture, cancelDraft, commitDraft, updateFromPageX],
  );
  const displayedValue = draftValue ?? value;
  const valueLabel = formatValue(displayedValue);
  const ratio = draftRatio ?? (displayedValue - minimum) / (maximum - minimum);
  const percentage = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  const adjust = useCallback(
    (direction: 1 | -1) =>
      onChange(stepReaderSliderValue(value, direction, minimum, maximum, step)),
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
      <View
        {...responder.panHandlers}
        aria-valuemax={maximum}
        aria-valuemin={minimum}
        aria-valuenow={displayedValue}
        aria-valuetext={valueLabel}
        accessibilityActions={[
          {
            name: "decrement",
            label: t("accessibility.decrease", { label }),
          },
          {
            name: "increment",
            label: t("accessibility.increase", { label }),
          },
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
        onLayout={() => measureTrack()}
        ref={sliderRef}
        style={styles.sliderTouchTarget}
      >
        <View style={styles.sliderTrack}>
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
      </View>
    </View>
  );
}

type ReadingSettingsTab = "page" | "text";

function fontSourceLabel(source: FontFamilyRecord["source"]): string {
  return source === "bundled"
    ? translate("reader.fonts.bundled")
    : source === "downloaded"
      ? translate("reader.fonts.downloaded")
      : translate("reader.fonts.imported");
}

export function ReadingSettingsPanel({
  appearance,
  fontFamilies,
  hasBookFonts = false,
  layout,
  pageTurnAnimation,
  theme,
  bottom,
  onAnimationChange,
  onChange,
  onClose,
  onDownloadFont,
  onImportFont,
  onLayoutChange,
  onRemoveFont,
}: ReadingSettingsPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReadingSettingsTab>("page");
  const [fontBusy, setFontBusy] = useState(false);
  const [fontError, setFontError] = useState<string | undefined>();
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const progressOptions: readonly {
    readonly value: ReaderProgressDisplay;
    readonly label: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "footer",
      label: t("reader.settings.progressFooter"),
      accessibilityLabel: t("reader.settings.progressFooterAccessibility"),
    },
    {
      value: "header",
      label: t("reader.settings.progressHeader"),
      accessibilityLabel: t("reader.settings.progressHeaderAccessibility"),
    },
    {
      value: "both",
      label: t("reader.settings.progressBoth"),
      accessibilityLabel: t("reader.settings.progressBothAccessibility"),
    },
    {
      value: "hidden",
      label: t("reader.settings.progressHidden"),
      accessibilityLabel: t("reader.settings.progressHiddenAccessibility"),
    },
  ];
  const colorModeOptions: readonly {
    readonly value: ReaderColorMode;
    readonly label: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "system",
      label: t("appearance.colorModes.system"),
      accessibilityLabel: t("appearance.colorModes.systemAccessibility"),
    },
    {
      value: "light",
      label: t("appearance.colorModes.light"),
      accessibilityLabel: t("appearance.colorModes.lightAccessibility"),
    },
    {
      value: "dark",
      label: t("appearance.colorModes.dark"),
      accessibilityLabel: t("appearance.colorModes.darkAccessibility"),
    },
  ];
  const settingsTabs: readonly {
    readonly value: ReadingSettingsTab;
    readonly label: string;
    readonly accessibilityLabel: string;
  }[] = [
    {
      value: "page",
      label: t("reader.settings.pageTab"),
      accessibilityLabel: t("reader.settings.pageTabAccessibility"),
    },
    {
      value: "text",
      label: t("reader.settings.textTab"),
      accessibilityLabel: t("reader.settings.textTabAccessibility"),
    },
  ];
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
  const replaceAppearance = useCallback(
    (next: ReaderAppearanceSettings) => {
      appearanceRef.current = next;
      onChange(next);
    },
    [onChange],
  );
  const resetPageSettings = useCallback(() => {
    replaceAppearance(resetPageAppearance(appearanceRef.current));
    onAnimationChange("natural");
    onLayoutChange("single");
  }, [onAnimationChange, onLayoutChange, replaceAppearance]);
  const resetTextSettings = useCallback(() => {
    replaceAppearance(resetTextAppearance(appearanceRef.current));
  }, [replaceAppearance]);
  const chooseFont = useCallback(
    (selectedFontId: string) => {
      update("font", {
        ...appearanceRef.current.font,
        selectedFontId,
      });
      setFontMenuOpen(false);
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
      setFontError(
        error instanceof Error ? error.message : t("errors.fonts.importFailed"),
      );
    } finally {
      setFontBusy(false);
    }
  }, [chooseFont, onImportFont, t]);
  const downloadFont = useCallback(
    async (familyId: string) => {
      setFontBusy(true);
      setFontError(undefined);
      try {
        chooseFont(await onDownloadFont(familyId));
      } catch (error) {
        setFontError(
          error instanceof Error
            ? error.message
            : t("errors.fonts.downloadFailed"),
        );
      } finally {
        setFontBusy(false);
      }
    },
    [chooseFont, onDownloadFont, t],
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
            error instanceof Error
              ? error.message
              : t("errors.fonts.deleteFailed"),
          );
        } finally {
          setFontBusy(false);
        }
      };
      Alert.alert(
        t("reader.fonts.deleteTitle"),
        t("reader.fonts.deleteConfirmation", { font: family.displayName }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => void remove(),
          },
        ],
      );
    },
    [onRemoveFont, t],
  );
  const selectableFonts = useMemo(
    () => fontFamilies.filter((family) => family.id !== BUILTIN_READER_MATH_ID),
    [fontFamilies],
  );
  const selectedFontAvailable = selectableFonts.some(
    (family) => family.id === appearance.font.selectedFontId,
  );
  const selectedFont = selectableFonts.find(
    (family) => family.id === appearance.font.selectedFontId,
  );
  const unavailableDownloadableFonts =
    DOWNLOADABLE_FONT_CATALOG.families.filter(
      (family) => !fontFamilies.some((candidate) => candidate.id === family.id),
    );

  return (
    <ReaderFloatingPanel
      bottom={bottom}
      height="62%"
      maxHeight="62%"
      theme={theme}
    >
      <View
        style={[styles.settingsHeader, { borderBottomColor: theme.border }]}
      >
        <View
          accessibilityLabel={t("reader.settings.groupAccessibility")}
          accessibilityRole="radiogroup"
          style={styles.settingsTabs}
        >
          {settingsTabs.map((tab) => {
            const selected = tab.value === activeTab;
            return (
              <Pressable
                accessibilityLabel={tab.accessibilityLabel}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                key={tab.value}
                onPress={() => {
                  setActiveTab(tab.value);
                  setFontMenuOpen(false);
                }}
                style={({ pressed }) => [
                  styles.settingsTab,
                  pressed && styles.settingsTabPressed,
                ]}
              >
                <Text
                  style={[
                    styles.settingsTabLabel,
                    {
                      color: selected
                        ? theme.accentStrong
                        : theme.secondaryText,
                    },
                    selected && styles.settingsTabLabelSelected,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.settingsTabIndicator,
                    {
                      backgroundColor: selected ? theme.accent : "transparent",
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <UiButton
          accessibilityLabel={t("reader.settings.closeAccessibility")}
          compact
          iconOnly
          label={t("reader.settings.closeAccessibility")}
          leadingIcon="close"
          onPress={onClose}
          textTone="muted"
          theme={theme}
          variant="ghost"
          style={styles.settingsCloseButton}
        />
      </View>

      <ScrollView
        key={activeTab}
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator={false}
        style={styles.settingsScroller}
      >
        {activeTab === "page" ? (
          <>
            <ReadingPageSettings
              layout={layout}
              pageTurnAnimation={pageTurnAnimation}
              theme={theme}
              onAnimationChange={onAnimationChange}
              onLayoutChange={onLayoutChange}
            />
            <View style={styles.settingSection}>
              <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
                {t("appearance.colorMode")}
              </Text>
              <UiSegmentedControl
                accessibilityLabel={t("appearance.readerColorModeGroup")}
                options={colorModeOptions}
                theme={theme}
                value={appearance.colorMode}
                onChange={(value) => update("colorMode", value)}
              />
            </View>

            <View style={styles.settingSection}>
              <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
                {t("appearance.theme")}
              </Text>
              <ReaderThemeSelector
                theme={theme}
                value={appearance.theme}
                onChange={(value) => update("theme", value)}
              />
            </View>

            <View style={styles.settingSection}>
              <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
                {t("reader.settings.progress")}
              </Text>
              <UiSegmentedControl
                accessibilityLabel={t(
                  "reader.settings.progressGroupAccessibility",
                )}
                options={progressOptions}
                theme={theme}
                value={appearance.progressDisplay}
                onChange={(value) => update("progressDisplay", value)}
              />
            </View>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Text style={[styles.footerHint, { color: theme.secondaryText }]}>
                {t("reader.settings.pageHint")}
              </Text>
              <Pressable
                accessibilityLabel={t("reader.settings.resetPageAccessibility")}
                accessibilityRole="button"
                onPress={resetPageSettings}
              >
                <Text style={[styles.resetText, { color: theme.accentStrong }]}>
                  {t("reader.settings.resetPage")}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.settingSection}>
              <Text style={[styles.sectionLabel, { color: theme.controlText }]}>
                {t("reader.fonts.section")}
              </Text>
              {!selectedFontAvailable ? (
                <Text style={[styles.fontError, { color: theme.accentStrong }]}>
                  {t("reader.fonts.unavailable")}
                </Text>
              ) : null}
              <Pressable
                accessibilityLabel={t("reader.fonts.chooseAccessibility", {
                  font: selectedFont?.displayName ?? t("reader.fonts.fallback"),
                })}
                accessibilityRole="button"
                accessibilityState={{ expanded: fontMenuOpen }}
                disabled={fontBusy}
                onPress={() => setFontMenuOpen((current) => !current)}
                style={({ pressed }) => [
                  styles.fontPicker,
                  {
                    backgroundColor: theme.panelRaised,
                    borderColor: fontMenuOpen ? theme.accent : theme.border,
                    opacity: fontBusy ? 0.55 : 1,
                  },
                  pressed && { backgroundColor: theme.panelMuted },
                ]}
              >
                <View style={styles.fontPickerCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.fontName, { color: theme.controlText }]}
                  >
                    {selectedFont?.displayName ??
                      t("reader.fonts.fallbackName")}
                  </Text>
                  {selectedFont ? (
                    <Text
                      style={[
                        styles.fontSource,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {fontSourceLabel(selectedFont.source)}
                    </Text>
                  ) : null}
                </View>
                <UiIcon
                  color={theme.secondaryText}
                  name="chevronDown"
                  size={18}
                />
              </Pressable>

              {fontMenuOpen ? (
                <View style={[styles.fontList, { borderColor: theme.border }]}>
                  {selectableFonts.map((family) => {
                    const selected =
                      appearance.font.selectedFontId === family.id;
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
                          accessibilityLabel={t(
                            "reader.fonts.fontAccessibility",
                            { font: family.displayName },
                          )}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          disabled={fontBusy}
                          onPress={() => chooseFont(family.id)}
                          style={styles.fontChoice}
                        >
                          <View style={styles.fontChoiceLabelRow}>
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
                            {selected ? (
                              <UiIcon
                                color={theme.accentStrong}
                                name="check"
                                size={15}
                              />
                            ) : null}
                          </View>
                          <Text
                            style={[
                              styles.fontSource,
                              { color: theme.secondaryText },
                            ]}
                          >
                            {fontSourceLabel(family.source)}
                          </Text>
                        </Pressable>
                        {family.source !== "bundled" ? (
                          <Pressable
                            accessibilityLabel={t(
                              "reader.fonts.deleteAccessibility",
                              { font: family.displayName },
                            )}
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
                              {t("common.delete")}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                  {unavailableDownloadableFonts.map((family) => (
                    <Pressable
                      accessibilityLabel={t(
                        "reader.fonts.downloadAccessibility",
                        { font: family.displayName },
                      )}
                      accessibilityRole="button"
                      disabled={fontBusy}
                      key={family.id}
                      onPress={() => void downloadFont(family.id)}
                      style={[
                        styles.downloadRow,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <View style={styles.downloadCopy}>
                        <Text
                          style={[
                            styles.fontName,
                            { color: theme.controlText },
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
                          {t("reader.fonts.available")}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.downloadButtonText,
                          { color: theme.accentStrong },
                        ]}
                      >
                        {t("common.download")}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityLabel={t("reader.fonts.importAccessibility")}
                    accessibilityRole="button"
                    disabled={fontBusy}
                    onPress={() => void importFont()}
                    style={styles.fontActionRow}
                  >
                    <Text
                      style={[
                        styles.importFontText,
                        { color: theme.accentStrong },
                      ]}
                    >
                      {fontBusy
                        ? t("common.processing")
                        : t("reader.fonts.importAction")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {fontError ? (
                <Text style={[styles.fontError, { color: theme.accentStrong }]}>
                  {fontError}
                </Text>
              ) : null}
            </View>

            <View style={styles.settingSection}>
              <View style={styles.bookFontRow}>
                <View style={styles.bookFontCopy}>
                  <Text
                    style={[styles.sectionLabel, { color: theme.controlText }]}
                  >
                    {t("reader.fonts.useBookFonts")}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      { color: theme.secondaryText },
                    ]}
                  >
                    {hasBookFonts
                      ? t("reader.fonts.useBookFontsDescription")
                      : t("reader.fonts.noBookFonts")}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={t("reader.fonts.useBookFonts")}
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
                  style={styles.bookFontSwitch}
                  value={hasBookFonts && appearance.font.useBookEmbeddedFonts}
                />
              </View>
            </View>

            <StyleSlider
              formatValue={(value) => `${value} px`}
              label={t("reader.fonts.fontSize")}
              maximum={32}
              minimum={16}
              step={1}
              theme={theme}
              value={appearance.fontSize}
              onChange={(value) => update("fontSize", value)}
            />
            <StyleSlider
              formatValue={(value) => `${value.toFixed(2)}×`}
              label={t("reader.fonts.lineHeight")}
              maximum={2.1}
              minimum={1.25}
              step={0.05}
              theme={theme}
              value={appearance.lineHeight}
              onChange={(value) => update("lineHeight", value)}
            />
            <StyleSlider
              formatValue={(value) => `${value.toFixed(1)} em`}
              label={t("reader.fonts.paragraphSpacing")}
              maximum={2}
              minimum={0}
              step={0.1}
              theme={theme}
              value={appearance.paragraphSpacing}
              onChange={(value) => update("paragraphSpacing", value)}
            />
            <StyleSlider
              formatValue={(value) => `${value} px`}
              label={t("reader.fonts.horizontalMargin")}
              maximum={72}
              minimum={16}
              step={4}
              theme={theme}
              value={appearance.horizontalMargin}
              onChange={(value) => update("horizontalMargin", value)}
            />

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Text style={[styles.footerHint, { color: theme.secondaryText }]}>
                {t("reader.settings.textHint")}
              </Text>
              <Pressable
                accessibilityLabel={t("reader.settings.resetTextAccessibility")}
                accessibilityRole="button"
                onPress={resetTextSettings}
              >
                <Text style={[styles.resetText, { color: theme.accentStrong }]}>
                  {t("reader.settings.resetText")}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
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
  bookFontSwitch: {
    transform: [{ scale: 0.86 }],
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
  fontActionRow: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  fontChoice: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  fontChoiceLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
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
  fontList: {
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fontName: {
    fontSize: 13,
    fontWeight: "600",
  },
  fontPicker: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  fontPickerCopy: {
    flex: 1,
    gap: 2,
  },
  fontRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  fontSource: {
    fontSize: 9,
  },
  footer: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingTop: 9,
  },
  footerHint: {
    flex: 1,
    fontSize: 10,
  },
  importFontText: {
    fontSize: 11,
    fontWeight: "600",
  },
  optionDescription: {
    fontSize: 10,
    lineHeight: 14,
  },
  resetText: {
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  settingSection: {
    gap: 6,
  },
  settingsHeader: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    minHeight: 34,
    paddingBottom: 6,
    position: "relative",
  },
  settingsList: {
    gap: 11,
    paddingRight: 3,
  },
  settingsScroller: {
    flex: 1,
    minHeight: 0,
  },
  settingsTabs: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.md,
  },
  settingsTab: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    minWidth: 64,
    paddingHorizontal: uiSpace.sm,
    position: "relative",
  },
  settingsTabIndicator: {
    borderRadius: 1,
    bottom: 0,
    height: 2,
    position: "absolute",
    width: 22,
  },
  settingsTabLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  settingsTabLabelSelected: {
    fontWeight: "600",
  },
  settingsTabPressed: {
    opacity: 0.56,
  },
  settingsCloseButton: {
    height: 30,
    minHeight: 30,
    position: "absolute",
    right: 0,
    top: 0,
    width: 30,
  },
  sliderFill: {
    borderRadius: 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  sliderLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderRail: {
    borderRadius: 2,
    height: 4,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 14,
  },
  sliderRow: {
    gap: 1,
  },
  sliderThumb: {
    borderRadius: READER_SLIDER_THUMB_SIZE / 2,
    borderWidth: 2,
    height: READER_SLIDER_THUMB_SIZE,
    marginLeft: -READER_SLIDER_THUMB_SIZE / 2,
    position: "absolute",
    top: (32 - READER_SLIDER_THUMB_SIZE) / 2,
    width: READER_SLIDER_THUMB_SIZE,
  },
  sliderTrack: {
    bottom: 0,
    left: READER_SLIDER_THUMB_SIZE / 2,
    position: "absolute",
    right: READER_SLIDER_THUMB_SIZE / 2,
    top: 0,
  },
  sliderTouchTarget: {
    height: 32,
    justifyContent: "center",
    width: "100%",
  },
  sliderValue: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});
