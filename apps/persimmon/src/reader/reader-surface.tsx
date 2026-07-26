import { NotoSansSC_400Regular } from "@expo-google-fonts/noto-sans-sc/400Regular";
import { NotoSerifSC_400Regular } from "@expo-google-fonts/noto-serif-sc/400Regular";
import type { BookIR, BookPosition } from "@persimmon/book-core";
import {
  LiveReader,
  type AutomaticPageTurnTuning,
  type GesturePageTurnTuning,
  type ReaderAppearance,
  type ReaderLayoutMode,
  type ReaderProgress,
} from "@persimmon/reader-skia";
import { READER_PAPER_COLOR } from "@persimmon/reader-skia/theme";
import { useFonts, type DataModule } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ReaderAppearanceSettings } from "../library/types";

const READER_SERIF_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSerifSC_400Regular as unknown as string,
      }
    : NotoSerifSC_400Regular;

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
  topInset: number;
  bottomInset: number;
  progressHeaderVisible: boolean;
  automaticPageTurnTuning: AutomaticPageTurnTuning;
  gesturePageTurnTuning: GesturePageTurnTuning;
  initialPosition?: BookPosition;
  loadResource: (assetId: string) => Promise<Uint8Array | undefined>;
  onCenterPress: () => void;
  onProgress: (progress: ReaderProgress) => void;
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
  topInset,
  bottomInset,
  progressHeaderVisible,
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  initialPosition,
  loadResource,
  onCenterPress,
  onProgress,
  onTurningChange,
  font,
  fontFamily,
}: FontBackedReaderSurfaceProps) {
  const fontProvider = useFonts({ [fontFamily]: [font] });
  useEffect(
    () => () => {
      if (typeof fontProvider?.dispose === "function") {
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

  if (!fontProvider) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#d95f2b" />
        <Text style={styles.loadingText}>正在准备中文排版…</Text>
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
      topInset={topInset}
      bottomInset={bottomInset}
      progressHeaderVisible={progressHeaderVisible}
      automaticPageTurnTuning={automaticPageTurnTuning}
      gesturePageTurnTuning={gesturePageTurnTuning}
      initialPosition={initialPosition}
      loadResource={loadResource}
      onCenterPress={onCenterPress}
      onProgress={onProgress}
      onTurningChange={onTurningChange}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: READER_PAPER_COLOR,
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: {
    color: "#81766c",
    fontSize: 14,
  },
});
