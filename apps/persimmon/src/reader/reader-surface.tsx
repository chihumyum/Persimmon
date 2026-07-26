import { NotoSansMath_400Regular } from "@expo-google-fonts/noto-sans-math/400Regular";
import { NotoSansSC_400Regular } from "@expo-google-fonts/noto-sans-sc/400Regular";
import { NotoSerifSC_400Regular } from "@expo-google-fonts/noto-serif-sc/400Regular";
import type { BookIR, BookPosition } from "@persimmon/book-core";
import {
  LiveReader,
  type AutomaticPageTurnTuning,
  type GesturePageTurnTuning,
  type ReaderAppearance,
  type ReaderLayoutMode,
  type ReaderPageTurnAnimation,
  type ReaderProgress,
  type ReaderSelectionMenuRequest,
  type ReaderTheme,
} from "@persimmon/reader-skia";
import { useFonts, type DataModule } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  hideSelectionMenu,
  showSelectionMenu,
} from "../../modules/persimmon-selection-menu";

import type { ReaderAppearanceSettings } from "../library/types";

const READER_SERIF_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSerifSC_400Regular as unknown as string,
      }
    : NotoSerifSC_400Regular;
const READER_SYMBOL_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSansMath_400Regular as unknown as string,
      }
    : NotoSansMath_400Regular;

const READER_SANS_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSansSC_400Regular as unknown as string,
      }
    : NotoSansSC_400Regular;

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
  automaticPageTurnTuning: AutomaticPageTurnTuning;
  gesturePageTurnTuning: GesturePageTurnTuning;
  initialPosition?: BookPosition;
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
  const fontFamily =
    appearance.fontFamily === "sans" ? "Noto Sans SC" : "Noto Serif SC";
  const font =
    appearance.fontFamily === "sans" ? READER_SANS_FONT : READER_SERIF_FONT;

  return (
    <FontBackedReaderSurface
      key={fontFamily}
      {...props}
      appearance={appearance}
      font={font}
      fontFamily={fontFamily}
    />
  );
}

interface FontBackedReaderSurfaceProps extends ReaderSurfaceProps {
  readonly font: DataModule;
  readonly fontFamily: string;
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
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  initialPosition,
  loadResource,
  onCenterPress,
  onProgress,
  onSelectionChange,
  onTurningChange,
  font,
  fontFamily,
}: FontBackedReaderSurfaceProps) {
  const fontProvider = useFonts({
    [fontFamily]: [font],
    "Noto Sans Math": [READER_SYMBOL_FONT],
  });
  useEffect(
    () => () => {
      if (
        Platform.OS === "web" &&
        typeof fontProvider?.dispose === "function"
      ) {
        fontProvider.dispose();
      }
    },
    [fontProvider],
  );
  const liveAppearance = useMemo<ReaderAppearance>(
    () => ({
      ...appearance,
      fontFamily,
    }),
    [appearance, fontFamily],
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
          正在准备中文排版…
        </Text>
      </View>
    );
  }

  return (
    <LiveReader
      book={book}
      fontProvider={fontProvider}
      width={width}
      height={height}
      appearance={liveAppearance}
      layout={layout}
      pageTurnAnimation={pageTurnAnimation}
      theme={theme}
      topInset={topInset}
      bottomInset={bottomInset}
      toolbarVisible={toolbarVisible}
      automaticPageTurnTuning={automaticPageTurnTuning}
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
