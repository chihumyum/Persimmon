import { NotoSerifSC_400Regular } from "@expo-google-fonts/noto-serif-sc/400Regular";
import type { BookIR, BookPosition } from "@persimmon/book-core";
import {
  LiveReader,
  type AutomaticPageTurnTuning,
  type GesturePageTurnTuning,
  type ReaderLayoutMode,
  type ReaderProgress,
} from "@persimmon/reader-skia";
import { READER_PAPER_COLOR } from "@persimmon/reader-skia/theme";
import { useFonts, type DataModule } from "@shopify/react-native-skia";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const READER_FONT: DataModule =
  Platform.OS === "web"
    ? {
        __esModule: true,
        default: NotoSerifSC_400Regular as unknown as string,
      }
    : NotoSerifSC_400Regular;

export interface ReaderSurfaceProps {
  book: BookIR;
  width: number;
  height: number;
  fontSize: number;
  layout: ReaderLayoutMode;
  automaticPageTurnTuning: AutomaticPageTurnTuning;
  gesturePageTurnTuning: GesturePageTurnTuning;
  initialPosition?: BookPosition;
  loadResource: (assetId: string) => Promise<Uint8Array | undefined>;
  onCenterPress: () => void;
  onProgress: (progress: ReaderProgress) => void;
  onTurningChange: (turning: boolean) => void;
}

export default function ReaderSurface({
  book,
  width,
  height,
  fontSize,
  layout,
  automaticPageTurnTuning,
  gesturePageTurnTuning,
  initialPosition,
  loadResource,
  onCenterPress,
  onProgress,
  onTurningChange,
}: ReaderSurfaceProps) {
  const fontProvider = useFonts({
    "Noto Serif SC": [READER_FONT],
  });

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
      fontSize={fontSize}
      layout={layout}
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
