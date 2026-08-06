import {
  BUILTIN_READER_MATH_ID,
  type FontFamilyRecord,
} from "@persimmon/font-core";
import type {
  ReaderLayoutMode,
  ReaderPageTurnAnimation,
  ReaderTheme,
  ReaderThemeName,
} from "@persimmon/reader-skia";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { DOWNLOADABLE_FONT_CATALOG } from "../fonts/downloadable-font-catalog";
import { ReaderBottomSheet } from "../components/reader-bottom-sheet";
import { ReaderChromeButton } from "../components/reader-chrome-button";
import { ReaderSegmentedControl } from "../components/reader-segmented-control";
import { ReaderSettingsMenuRow } from "../components/reader-settings-menu-row";
import { ReaderSettingsSwitchRow } from "../components/reader-settings-switch-row";
import { ReaderTypographyPreview } from "../components/reader-typography-preview";
import { UiButton } from "../components/ui-button";
import { UiIcon } from "../components/ui-icon";
import {
  uiRadius,
  uiSheet,
  uiSize,
  uiSpace,
  uiTypography,
} from "../components/ui-tokens";
import type {
  ReaderAppearanceSettings,
  ReaderColorMode,
  ReaderProgressDisplay,
} from "../library/types";
import type {
  ReaderSettingsPage,
  ReaderSettingsTab,
} from "../reader/reader-overlay-state";
import { resetReadingAppearance } from "../reader/reader-settings-category";
import type { ReaderTypographyKey } from "../reader/reader-typography-preview";
import { ReadingPageSettings } from "./reading-layout-panel";

// The compact landscape fraction can be shorter than the fixed native wheel.
// Keep room for the 66 pt header, 210 pt picker, and 58 pt reset footer.
const MINIMUM_TYPOGRAPHY_SHEET_HEIGHT = 350;
const CONTENT_EXIT_DURATION_MS = 80;
const CONTENT_ENTER_DURATION_MS = 160;

interface SettingsContentState {
  readonly page: ReaderSettingsPage;
  readonly tab: ReaderSettingsTab;
}

function snapIndexForPage(page: ReaderSettingsPage): number {
  switch (page) {
    case "typographyPreview":
      return 0;
    case "root":
      return 1;
    case "fonts":
      return 2;
  }
}

function androidHeightRatioForPage(
  page: ReaderSettingsPage,
  windowHeight: number,
): number {
  switch (page) {
    case "typographyPreview":
      return Math.min(
        0.92,
        Math.max(
          uiSheet.readerSettingsTypographyHeightRatio,
          MINIMUM_TYPOGRAPHY_SHEET_HEIGHT / windowHeight,
        ),
      );
    case "root":
      return uiSheet.readerSettingsRootHeightRatio;
    case "fonts":
      return uiSheet.readerSettingsFontHeightRatio;
  }
}

interface ReadingSettingsSheetProps {
  readonly activeTab: ReaderSettingsTab;
  readonly appearance: ReaderAppearanceSettings;
  readonly bottomInset: number;
  readonly fontFamilies: readonly FontFamilyRecord[];
  readonly hasBookFonts: boolean;
  readonly layout: ReaderLayoutMode;
  readonly page: ReaderSettingsPage;
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly rapidPageTurnEnabled: boolean;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onAnimationChange: (animation: ReaderPageTurnAnimation) => void;
  readonly onAppearanceChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onBackPress: () => void;
  readonly onClose: () => void;
  readonly onDownloadFont: (familyId: string) => Promise<string>;
  readonly onImportFont: () => Promise<string | undefined>;
  readonly onLayoutChange: (layout: ReaderLayoutMode) => void;
  readonly onPageChange: (page: ReaderSettingsPage) => void;
  readonly onRapidPageTurnEnabledChange: (enabled: boolean) => void;
  readonly onRemoveFont: (familyId: string) => Promise<void>;
  readonly onStartTypographyPreview: () => void;
  readonly onTabChange: (tab: ReaderSettingsTab) => void;
  readonly onTypographyChange: (
    key: ReaderTypographyKey,
    value: number,
  ) => void;
  readonly onTypographyBack: () => void;
  readonly onTypographyReset: () => void;
}

interface SettingsRowProps {
  readonly accessibilityLabel: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly trailing?: React.ReactNode;
  readonly value?: string;
  readonly onPress?: () => void;
}

function SettingsRow({
  accessibilityLabel,
  description,
  disabled = false,
  theme,
  title,
  trailing,
  value,
  onPress,
}: SettingsRowProps) {
  const content = (
    <>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.controlText }]}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: theme.secondaryText }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          numberOfLines={1}
          style={[styles.rowValue, { color: theme.secondaryText }]}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
    </>
  );
  if (!onPress) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[styles.settingsRow, disabled && styles.disabled]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && { backgroundColor: theme.panelMuted },
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

interface FontPickerPageProps {
  readonly appearance: ReaderAppearanceSettings;
  readonly bottomInset: number;
  readonly fontFamilies: readonly FontFamilyRecord[];
  readonly theme: ReaderTheme;
  readonly onAppearanceChange: (appearance: ReaderAppearanceSettings) => void;
  readonly onDownloadFont: (familyId: string) => Promise<string>;
  readonly onImportFont: () => Promise<string | undefined>;
  readonly onRemoveFont: (familyId: string) => Promise<void>;
}

function FontPickerPage({
  appearance,
  bottomInset,
  fontFamilies,
  theme,
  onAppearanceChange,
  onDownloadFont,
  onImportFont,
  onRemoveFont,
}: FontPickerPageProps) {
  const { t } = useTranslation();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const busy = busyAction !== undefined;
  const selectableFonts = useMemo(
    () => fontFamilies.filter((family) => family.id !== BUILTIN_READER_MATH_ID),
    [fontFamilies],
  );
  const unavailableFonts = useMemo(
    () =>
      DOWNLOADABLE_FONT_CATALOG.families.filter(
        (family) =>
          !fontFamilies.some((candidate) => candidate.id === family.id),
      ),
    [fontFamilies],
  );
  const chooseFont = useCallback(
    (selectedFontId: string) => {
      onAppearanceChange({
        ...appearance,
        font: { ...appearance.font, selectedFontId },
      });
    },
    [appearance, onAppearanceChange],
  );
  const runFontAction = useCallback(
    async (actionId: string, action: () => Promise<string | undefined>) => {
      setBusyAction(actionId);
      setError(undefined);
      try {
        const familyId = await action();
        if (familyId) {
          chooseFont(familyId);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("errors.fonts.loadFailed"),
        );
      } finally {
        setBusyAction(undefined);
      }
    },
    [chooseFont, t],
  );
  const confirmRemove = useCallback(
    (family: FontFamilyRecord) => {
      Alert.alert(
        t("reader.fonts.deleteTitle"),
        t("reader.fonts.deleteConfirmation", { font: family.displayName }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              void runFontAction(`delete:${family.id}`, async () => {
                await onRemoveFont(family.id);
                return undefined;
              });
            },
          },
        ],
      );
    },
    [onRemoveFont, runFontAction, t],
  );
  return (
    <ScrollView
      contentContainerStyle={[
        styles.fontList,
        { paddingBottom: bottomInset + uiSpace.xxl },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.sheetPage}
    >
      {error ? (
        <Text style={[styles.error, { color: theme.noteAccent }]}>{error}</Text>
      ) : null}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.border,
          },
        ]}
      >
        {selectableFonts.map((family, index) => {
          const selected = family.id === appearance.font.selectedFontId;
          return (
            <View key={family.id}>
              {index > 0 ? (
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />
              ) : null}
              <View style={styles.fontRow}>
                <Pressable
                  accessibilityLabel={t("reader.fonts.fontAccessibility", {
                    font: family.displayName,
                  })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  disabled={busy}
                  onPress={() => chooseFont(family.id)}
                  style={({ pressed }) => [
                    styles.fontChoice,
                    pressed && { backgroundColor: theme.panelMuted },
                  ]}
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
                  {selected ? (
                    <UiIcon color={theme.accentStrong} name="check" size={20} />
                  ) : null}
                </Pressable>
                {family.source !== "bundled" ? (
                  <Pressable
                    accessibilityLabel={t("reader.fonts.deleteAccessibility", {
                      font: family.displayName,
                    })}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => confirmRemove(family)}
                    style={styles.fontAction}
                  >
                    <Text
                      style={[styles.actionText, { color: theme.noteAccent }]}
                    >
                      {t("common.delete")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {unavailableFonts.map((family) => (
          <View key={family.id}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable
              accessibilityLabel={t("reader.fonts.downloadAccessibility", {
                font: family.displayName,
              })}
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                void runFontAction(family.id, () => onDownloadFont(family.id))
              }
              style={({ pressed }) => [
                styles.downloadRow,
                pressed && { backgroundColor: theme.panelMuted },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.fontName, { color: theme.controlText }]}
              >
                {family.displayName}
              </Text>
              {busyAction === family.id ? (
                <ActivityIndicator color={theme.accentStrong} size="small" />
              ) : (
                <UiIcon color={theme.accentStrong} name="cloud" size={22} />
              )}
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityLabel={t("reader.fonts.importAccessibility")}
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void runFontAction("import", onImportFont)}
        style={({ pressed }) => [
          styles.importRow,
          {
            backgroundColor: theme.panelRaised,
            borderColor: theme.border,
          },
          pressed && { backgroundColor: theme.panelMuted },
        ]}
      >
        {busyAction === "import" ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <UiIcon color={theme.accentStrong} name="add" size={18} />
        )}
        <Text style={[styles.actionText, { color: theme.accentStrong }]}>
          {t("reader.fonts.importAction")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export function ReadingSettingsSheet({
  activeTab,
  appearance,
  bottomInset,
  fontFamilies,
  hasBookFonts,
  layout,
  page,
  pageTurnAnimation,
  rapidPageTurnEnabled,
  theme,
  visible,
  onAnimationChange,
  onAppearanceChange,
  onBackPress,
  onClose,
  onDownloadFont,
  onImportFont,
  onLayoutChange,
  onPageChange,
  onRapidPageTurnEnabledChange,
  onRemoveFont,
  onStartTypographyPreview,
  onTabChange,
  onTypographyChange,
  onTypographyBack,
  onTypographyReset,
}: ReadingSettingsSheetProps) {
  const { t } = useTranslation();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const contentBottomInset = Platform.OS === "android" ? 0 : bottomInset;
  const settingsSnapPoints = useMemo<(string | number)[]>(() => {
    const isLargeLandscape =
      windowWidth > windowHeight && Math.min(windowWidth, windowHeight) >= 600;
    return [
      isLargeLandscape
        ? MINIMUM_TYPOGRAPHY_SHEET_HEIGHT
        : `${Math.round(uiSheet.readerSettingsTypographyHeightRatio * 100)}%`,
      `${Math.round(uiSheet.readerSettingsRootHeightRatio * 100)}%`,
      `${Math.round(uiSheet.readerSettingsFontHeightRatio * 100)}%`,
    ];
  }, [windowHeight, windowWidth]);
  const [closingPage, setClosingPage] = useState(page);
  const contentPage = visible ? page : closingPage;
  const [displayedContent, setDisplayedContent] =
    useState<SettingsContentState>({ page: contentPage, tab: activeTab });
  const displayedContentRef = useRef(displayedContent);
  const contentTransitionGenerationRef = useRef(0);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    if (visible) {
      setClosingPage(page);
    }
  }, [page, visible]);

  useEffect(() => {
    const generation = contentTransitionGenerationRef.current + 1;
    contentTransitionGenerationRef.current = generation;
    const displayed = displayedContentRef.current;
    let enterFrame: number | undefined;

    contentOpacity.stopAnimation();
    contentTranslateY.stopAnimation();

    if (displayed.page === contentPage && displayed.tab === activeTab) {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          duration: CONTENT_ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          duration: CONTENT_ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          duration: CONTENT_EXIT_DURATION_MS,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          duration: CONTENT_EXIT_DURATION_MS,
          easing: Easing.in(Easing.quad),
          toValue: -4,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (
          !finished ||
          generation !== contentTransitionGenerationRef.current
        ) {
          return;
        }
        const nextContent = { page: contentPage, tab: activeTab };
        displayedContentRef.current = nextContent;
        setDisplayedContent(nextContent);
        contentOpacity.setValue(0);
        contentTranslateY.setValue(6);
        enterFrame = requestAnimationFrame(() => {
          if (generation !== contentTransitionGenerationRef.current) {
            return;
          }
          Animated.parallel([
            Animated.timing(contentOpacity, {
              duration: CONTENT_ENTER_DURATION_MS,
              easing: Easing.out(Easing.cubic),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(contentTranslateY, {
              duration: CONTENT_ENTER_DURATION_MS,
              easing: Easing.out(Easing.cubic),
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
        });
      });
    }

    return () => {
      contentTransitionGenerationRef.current += 1;
      if (enterFrame !== undefined) {
        cancelAnimationFrame(enterFrame);
      }
      contentOpacity.stopAnimation();
      contentTranslateY.stopAnimation();
    };
  }, [activeTab, contentOpacity, contentPage, contentTranslateY]);

  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const update = useCallback(
    <Key extends keyof ReaderAppearanceSettings>(
      key: Key,
      value: ReaderAppearanceSettings[Key],
    ) => {
      const next = { ...appearanceRef.current, [key]: value };
      appearanceRef.current = next;
      onAppearanceChange(next);
    },
    [onAppearanceChange],
  );
  const selectedFont = fontFamilies.find(
    (family) => family.id === appearance.font.selectedFontId,
  );
  const progressOptions: readonly {
    readonly value: ReaderProgressDisplay;
    readonly label: string;
  }[] = [
    { value: "footer", label: t("reader.settings.progressFooter") },
    { value: "header", label: t("reader.settings.progressHeader") },
    { value: "both", label: t("reader.settings.progressBoth") },
    { value: "hidden", label: t("reader.settings.progressHidden") },
  ];
  const progressLabel =
    progressOptions.find(
      (option) => option.value === appearance.progressDisplay,
    )?.label ?? progressOptions[0]!.label;
  const colorModeOptions: readonly {
    readonly value: ReaderColorMode;
    readonly label: string;
  }[] = [
    { value: "system", label: t("appearance.colorModes.system") },
    { value: "light", label: t("appearance.colorModes.light") },
    { value: "dark", label: t("appearance.colorModes.dark") },
  ];
  const colorModeLabel =
    colorModeOptions.find((option) => option.value === appearance.colorMode)
      ?.label ?? colorModeOptions[0]!.label;
  const themeOptions: readonly {
    readonly value: ReaderThemeName;
    readonly label: string;
  }[] = [
    { value: "warm", label: t("appearance.themes.warm") },
    { value: "cool", label: t("appearance.themes.cool") },
  ];
  const themeLabel =
    themeOptions.find((option) => option.value === appearance.theme)?.label ??
    themeOptions[0]!.label;
  const tabOptions: readonly {
    readonly value: ReaderSettingsTab;
    readonly label: string;
  }[] = [
    { value: "typography", label: t("reader.settings.typographyTab") },
    { value: "reading", label: t("reader.settings.readingTab") },
  ];

  const resetReading = useCallback(() => {
    onAppearanceChange(resetReadingAppearance(appearanceRef.current));
    onAnimationChange("natural");
    onRapidPageTurnEnabledChange(true);
    onLayoutChange("single");
  }, [
    onAnimationChange,
    onAppearanceChange,
    onLayoutChange,
    onRapidPageTurnEnabledChange,
  ]);

  const renderContent = (content: SettingsContentState) => {
    if (content.page === "fonts") {
      return (
        <FontPickerPage
          appearance={appearance}
          bottomInset={contentBottomInset}
          fontFamilies={fontFamilies}
          theme={theme}
          onAppearanceChange={onAppearanceChange}
          onDownloadFont={onDownloadFont}
          onImportFont={onImportFont}
          onRemoveFont={onRemoveFont}
        />
      );
    }

    if (content.page === "typographyPreview") {
      return (
        <ReaderTypographyPreview
          appearance={appearance}
          theme={theme}
          onChange={onTypographyChange}
          onReset={onTypographyReset}
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={[
          styles.settingsList,
          { paddingBottom: contentBottomInset + uiSpace.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {content.tab === "typography" ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.panelRaised,
                borderColor: theme.border,
              },
            ]}
          >
            <SettingsRow
              accessibilityLabel={t("reader.fonts.chooseAccessibility", {
                font:
                  selectedFont?.displayName ?? t("reader.fonts.fallbackName"),
              })}
              theme={theme}
              title={t("reader.fonts.section")}
              trailing={
                <UiIcon
                  color={theme.secondaryText}
                  name="chevronRight"
                  size={18}
                />
              }
              value={
                selectedFont?.displayName ?? t("reader.fonts.fallbackName")
              }
              onPress={() => onPageChange("fonts")}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ReaderSettingsSwitchRow
              description={
                hasBookFonts
                  ? t("reader.fonts.useBookFontsDescription")
                  : t("reader.fonts.noBookFonts")
              }
              disabled={!hasBookFonts}
              label={t("reader.fonts.useBookFonts")}
              theme={theme}
              value={appearance.font.useBookEmbeddedFonts}
              onChange={(useBookEmbeddedFonts) =>
                update("font", {
                  ...appearanceRef.current.font,
                  useBookEmbeddedFonts,
                })
              }
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingsRow
              accessibilityLabel={t("reader.settings.adjustTypography")}
              theme={theme}
              title={t("reader.settings.adjustTypography")}
              trailing={
                <View style={styles.rowAction}>
                  <UiIcon
                    color={theme.accentStrong}
                    name="typography"
                    size={18}
                  />
                  <UiIcon
                    color={theme.secondaryText}
                    name="chevronRight"
                    size={18}
                  />
                </View>
              }
              onPress={onStartTypographyPreview}
            />
          </View>
        ) : (
          <>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.panelRaised,
                  borderColor: theme.border,
                },
              ]}
            >
              <ReadingPageSettings
                layout={layout}
                pageTurnAnimation={pageTurnAnimation}
                rapidPageTurnEnabled={rapidPageTurnEnabled}
                theme={theme}
                onAnimationChange={onAnimationChange}
                onLayoutChange={onLayoutChange}
                onRapidPageTurnEnabledChange={onRapidPageTurnEnabledChange}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <ReaderSettingsMenuRow<ReaderColorMode>
                accessibilityLabel={`${t(
                  "appearance.readerColorModeGroup",
                )}: ${colorModeLabel}`}
                options={colorModeOptions}
                theme={theme}
                title={t("appearance.colorMode")}
                value={appearance.colorMode}
                onChange={(value) => update("colorMode", value)}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <ReaderSettingsMenuRow<ReaderThemeName>
                accessibilityLabel={`${t(
                  "appearance.readerThemeGroup",
                )}: ${themeLabel}`}
                options={themeOptions}
                theme={theme}
                title={t("appearance.theme")}
                value={appearance.theme}
                onChange={(value) => update("theme", value)}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <ReaderSettingsMenuRow<ReaderProgressDisplay>
                accessibilityLabel={t(
                  "reader.settings.progressValueAccessibility",
                  { value: progressLabel },
                )}
                options={progressOptions}
                theme={theme}
                title={t("reader.settings.progress")}
                value={appearance.progressDisplay}
                onChange={(value) => update("progressDisplay", value)}
              />
            </View>
            <UiButton
              accessibilityLabel={t(
                "reader.settings.resetReadingAccessibility",
              )}
              label={t("reader.settings.resetReading")}
              onPress={resetReading}
              textTone="accent"
              theme={theme}
              variant="ghost"
            />
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <ReaderBottomSheet
      allowsUserResizing={uiSheet.readerSettingsAllowsUserResizing}
      androidHeightRatio={androidHeightRatioForPage(contentPage, windowHeight)}
      dismissible
      snapIndex={snapIndexForPage(contentPage)}
      snapPoints={settingsSnapPoints}
      testID="reader-settings-sheet"
      theme={theme}
      visible={visible}
      onBackPress={onBackPress}
      onDismiss={onClose}
    >
      <View style={styles.sheetPage}>
        <View style={styles.tabBar}>
          <View style={styles.tabSide}>
            {contentPage !== "root" ? (
              <ReaderChromeButton
                accessibilityLabel={t(
                  "reader.settings.backToSettingsAccessibility",
                )}
                icon="back"
                label={t("reader.settings.backToSettingsAccessibility")}
                onPress={
                  contentPage === "typographyPreview"
                    ? onTypographyBack
                    : () => onPageChange("root")
                }
                theme={theme}
                tintColor={theme.secondaryText}
              />
            ) : null}
          </View>
          <View style={styles.tabControl}>
            <ReaderSegmentedControl
              accessibilityLabel={t("reader.settings.groupAccessibility")}
              options={tabOptions}
              theme={theme}
              value={activeTab}
              onChange={onTabChange}
            />
          </View>
          <View style={[styles.tabSide, styles.tabSideEnd]}>
            <ReaderChromeButton
              accessibilityLabel={t("reader.settings.closeAccessibility")}
              icon="close"
              label={t("common.close")}
              onPress={onClose}
              theme={theme}
              tintColor={theme.secondaryText}
            />
          </View>
        </View>
        <Animated.View
          pointerEvents={
            displayedContent.page === contentPage &&
            displayedContent.tab === activeTab
              ? "auto"
              : "none"
          }
          style={[
            styles.contentTransition,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {renderContent(displayedContent)}
        </Animated.View>
      </View>
    </ReaderBottomSheet>
  );
}

const styles = StyleSheet.create({
  actionText: {
    ...uiTypography.optionAction,
  },
  card: {
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  contentTransition: {
    flex: 1,
    overflow: "hidden",
  },
  disabled: {
    opacity: 0.48,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: uiSize.dividerHorizontalInset,
  },
  downloadRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.md,
    minHeight: uiSize.optionRow,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  error: {
    ...uiTypography.optionDescription,
    paddingHorizontal: uiSize.optionHorizontalInset,
    paddingVertical: uiSpace.sm,
  },
  fontAction: {
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: uiSize.minimumHitTarget,
    minWidth: 68,
  },
  fontChoice: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: uiSpace.md,
    justifyContent: "space-between",
    minHeight: uiSize.optionRow,
  },
  fontList: {
    gap: uiSpace.lg,
    paddingHorizontal: uiSpace.lg,
    paddingTop: uiSpace.sm,
  },
  fontName: {
    flex: 1,
    flexShrink: 1,
    ...uiTypography.optionLabel,
  },
  fontRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: uiSize.optionRow,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  importRow: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: uiSpace.sm,
    justifyContent: "center",
    minHeight: uiSize.optionRow,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  rowCopy: {
    flex: 1,
    gap: uiSpace.xxs,
  },
  rowDescription: {
    ...uiTypography.optionDescription,
  },
  rowAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.sm,
  },
  rowTitle: {
    ...uiTypography.optionLabel,
  },
  rowValue: {
    flexShrink: 1,
    ...uiTypography.optionValue,
    maxWidth: "45%",
  },
  settingsList: {
    gap: uiSpace.lg,
    paddingHorizontal: uiSpace.lg,
    paddingTop: uiSpace.md,
  },
  settingsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.sm,
    minHeight: uiSize.optionRow,
    paddingHorizontal: uiSize.optionHorizontalInset,
    paddingVertical: uiSpace.sm,
  },
  sheetPage: {
    flex: 1,
  },
  tabBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: uiSpace.sm,
    paddingHorizontal: uiSpace.lg,
    height: uiSize.sheetHeader,
  },
  tabControl: {
    flex: 1,
  },
  tabSide: {
    minWidth: uiSize.control,
    width: uiSize.control,
  },
  tabSideEnd: {
    alignItems: "flex-end",
  },
});
