import type { BookIR, BookPosition } from "@persimmon/book-core";
import type { FontFamilyRecord } from "@persimmon/font-core";
import {
  LiveReader,
  type AutomaticPageTurnTuning,
  type GesturePageTurnTuning,
  type ReverseAutomaticPageTurnTuning,
  type ReverseGesturePageTurnTuning,
  type ReaderAppearance,
  type ReaderLayoutMode,
  type ReaderPageTurnAnimation,
  type ReaderProgress,
  type ReaderSelectionMenuRequest,
  type ReaderTheme,
  type ReaderUiMessages,
} from "@persimmon/reader-skia";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import {
  hideSelectionMenu,
  showSelectionMenu,
} from "../../modules/persimmon-selection-menu";

import { UiText as Text } from "../components/ui-text";
import type { ReaderAppearanceSettings } from "../library/types";
import { useReaderFontProvider } from "./use-reader-font-provider";

export interface ReaderSurfaceProps {
  book: BookIR;
  width: number;
  height: number;
  appearance: ReaderAppearanceSettings;
  layout: ReaderLayoutMode;
  pageTurnAnimation: ReaderPageTurnAnimation;
  rapidPageTurnEnabled: boolean;
  theme: ReaderTheme;
  topInset: number;
  bottomInset: number;
  toolbarVisible: boolean;
  automaticPageTurnTuning: AutomaticPageTurnTuning;
  reverseAutomaticPageTurnTuning: ReverseAutomaticPageTurnTuning;
  gesturePageTurnTuning: GesturePageTurnTuning;
  reverseGesturePageTurnTuning: ReverseGesturePageTurnTuning;
  initialPosition?: BookPosition;
  fontFamilies: readonly FontFamilyRecord[];
  loadFontFace: (faceId: string) => Promise<Uint8Array | undefined>;
  loadResource: (assetId: string) => Promise<Uint8Array | undefined>;
  onCenterPress: () => void;
  onProgress: (progress: ReaderProgress) => void;
  onSelectionChange: (selecting: boolean) => void;
  onTurningChange: (turning: boolean) => void;
}

export default function ReaderSurface({
  appearance,
  ...props
}: ReaderSurfaceProps) {
  const font = useReaderFontProvider(
    appearance.font.selectedFontId,
    props.fontFamilies,
    props.loadFontFace,
    props.book,
    appearance.font.useBookEmbeddedFonts,
    props.loadResource,
  );

  return (
    <FontBackedReaderSurface
      {...props}
      appearance={appearance}
      fontFamily={font.fontFamily}
      fontProvider={font.fontProvider}
      fontError={font.error}
      bookFontFamilyNames={font.bookFontFamilyNames}
      fontProviderKey={font.providerKey}
    />
  );
}

interface FontBackedReaderSurfaceProps extends ReaderSurfaceProps {
  readonly fontError?: string;
  readonly fontFamily: string;
  readonly bookFontFamilyNames?: Readonly<Record<string, string>>;
  readonly fontProvider: ReturnType<
    typeof useReaderFontProvider
  >["fontProvider"];
  readonly fontProviderKey: string;
}

function FontBackedReaderSurface({
  book,
  width,
  height,
  appearance,
  layout,
  pageTurnAnimation,
  rapidPageTurnEnabled,
  theme,
  topInset,
  bottomInset,
  toolbarVisible,
  automaticPageTurnTuning,
  reverseAutomaticPageTurnTuning,
  gesturePageTurnTuning,
  reverseGesturePageTurnTuning,
  initialPosition,
  loadResource,
  onCenterPress,
  onProgress,
  onSelectionChange,
  onTurningChange,
  fontError,
  fontFamily,
  bookFontFamilyNames,
  fontProvider,
  fontProviderKey,
}: FontBackedReaderSurfaceProps) {
  const { t, i18n } = useTranslation();
  const uiMessages = useMemo<ReaderUiMessages>(
    () => ({
      previousPage: t("reader.accessibility.previousPage"),
      nextPage: t("reader.accessibility.nextPage"),
      toggleTools: t("reader.accessibility.toggleTools"),
      selectionStart: t("reader.accessibility.selectionStart"),
      selectionEnd: t("reader.accessibility.selectionEnd"),
      header: (title) => t("reader.accessibility.header", { title }),
      publicationPercentage: (percentage) =>
        t("reader.accessibility.publicationPercentage", { percentage }),
      publicationPage: (page) =>
        t("reader.accessibility.publicationPage", { page }),
      noteKindEndnote: t("reader.accessibility.noteKindEndnote"),
      noteKindFootnote: t("reader.accessibility.noteKindFootnote"),
      noteKindAnnotation: t("reader.accessibility.noteKindAnnotation"),
      openNote: (noteKind, label) =>
        t("reader.accessibility.openNote", { noteKind, label }),
      returnToText: (label) =>
        t("reader.accessibility.returnToText", { label }),
      jumpTo: (label) => t("reader.accessibility.jumpTo", { label }),
      noteHint: t("reader.accessibility.noteHint"),
      returnToReference: (noteKind, label) =>
        t("reader.accessibility.returnToReference", { noteKind, label }),
      returnToTextButton: t("reader.accessibility.returnToTextButton"),
      dismissReturnButton: (noteKind) =>
        t("reader.accessibility.dismissReturnButton", { noteKind }),
    }),
    [i18n.resolvedLanguage, t],
  );
  const liveAppearance = useMemo<ReaderAppearance>(
    () => ({
      theme: appearance.theme,
      colorMode: appearance.colorMode,
      fontFamily,
      decorationFontFamily: "Noto Sans SC",
      ...(bookFontFamilyNames ? { bookFontFamilyNames } : {}),
      fontSize: appearance.fontSize,
      lineHeight: appearance.lineHeight,
      paragraphSpacing: appearance.paragraphSpacing,
      inlineMargin: appearance.horizontalMargin,
      textAlignment: appearance.textAlignment,
      progressDisplay: appearance.progressDisplay,
    }),
    [appearance, bookFontFamilyNames, fontFamily],
  );
  const handleSelectionMenuRequest = useCallback(
    ({ text, rectInWindow }: ReaderSelectionMenuRequest) => {
      void showSelectionMenu(text, rectInWindow);
    },
    [],
  );
  const handleSelectionMenuDismiss = useCallback(() => {
    void hideSelectionMenu();
  }, []);

  if (!fontProvider) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.paper }]}>
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
          {fontError ?? t("reader.loading.preparingTypography")}
        </Text>
      </View>
    );
  }

  return (
    <LiveReader
      book={book}
      fontProvider={fontProvider}
      fontProviderKey={fontProviderKey}
      width={width}
      height={height}
      appearance={liveAppearance}
      layout={layout}
      pageTurnAnimation={pageTurnAnimation}
      rapidPageTurnEnabled={rapidPageTurnEnabled}
      theme={theme}
      topInset={topInset}
      bottomInset={bottomInset}
      toolbarVisible={toolbarVisible}
      uiMessages={uiMessages}
      automaticPageTurnTuning={automaticPageTurnTuning}
      reverseAutomaticPageTurnTuning={reverseAutomaticPageTurnTuning}
      gesturePageTurnTuning={gesturePageTurnTuning}
      reverseGesturePageTurnTuning={reverseGesturePageTurnTuning}
      initialPosition={initialPosition}
      loadResource={loadResource}
      onCenterPress={onCenterPress}
      onProgress={onProgress}
      onSelectionChange={onSelectionChange}
      onSelectionMenuDismiss={handleSelectionMenuDismiss}
      onSelectionMenuRequest={handleSelectionMenuRequest}
      onTurningChange={onTurningChange}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
  },
});
