import type { BookIR, BookPosition } from "@persimmon/book-core";
import type { FontFamilyRecord } from "@persimmon/font-core";
import {
  DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  LiveReader,
  type GesturePageTurnTuning,
  type ReaderAppearance,
  type ReaderLayoutMode,
  type ReaderPageTurnAnimation,
  type ReaderProgress,
  type ReaderSelectionMenuRequest,
  type ReaderTheme,
} from "@persimmon/reader-skia";
import { useCallback, useMemo } from "react";
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
  theme: ReaderTheme;
  topInset: number;
  bottomInset: number;
  toolbarVisible: boolean;
  gesturePageTurnTuning: GesturePageTurnTuning;
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
  theme,
  topInset,
  bottomInset,
  toolbarVisible,
  gesturePageTurnTuning,
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
      horizontalMargin: appearance.horizontalMargin,
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
          {fontError ?? "正在准备中文排版…"}
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
      theme={theme}
      topInset={topInset}
      bottomInset={bottomInset}
      toolbarVisible={toolbarVisible}
      automaticPageTurnTuning={DEFAULT_AUTOMATIC_PAGE_TURN_TUNING}
      gesturePageTurnTuning={gesturePageTurnTuning}
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
