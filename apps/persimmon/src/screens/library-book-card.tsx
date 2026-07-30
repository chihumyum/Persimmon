import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";

import { UiIcon } from "../components/ui-icon";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";
import {
  readingProgressPercent,
  readingStatusForEntry,
} from "../library/library-view";
import {
  libraryRepository,
  type LibraryBookSummary,
} from "../library/repository";
import type { BookMenuRect } from "../../modules/persimmon-selection-menu";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const DEFAULT_COVER_RATIO = 0.7;

function base64Of(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += BASE64_ALPHABET[first >> 2];
    output += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    output +=
      second === undefined
        ? "="
        : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? "=" : BASE64_ALPHABET[third & 0x3f];
  }
  return output;
}

function fittedCoverSize(
  ratio: number,
  maximumWidth: number,
  maximumHeight: number,
): { readonly width: number; readonly height: number } {
  const boundedRatio = Math.min(2.4, Math.max(0.34, ratio));
  if (boundedRatio >= maximumWidth / maximumHeight) {
    return {
      width: maximumWidth,
      height: maximumWidth / boundedRatio,
    };
  }
  return {
    width: maximumHeight * boundedRatio,
    height: maximumHeight,
  };
}

function BookCover({
  entry,
  maximumHeight,
  maximumWidth,
  theme,
}: {
  readonly entry: LibraryBookSummary;
  readonly maximumHeight: number;
  readonly maximumWidth: number;
  readonly theme: ReaderTheme;
}) {
  const [uri, setUri] = useState<string>();
  const [ratio, setRatio] = useState(DEFAULT_COVER_RATIO);

  useEffect(() => {
    setRatio(DEFAULT_COVER_RATIO);
    if (!entry.coverAssetId || !entry.coverMediaType) {
      setUri(undefined);
      return;
    }
    let cancelled = false;
    void libraryRepository
      .getResource(entry.id, entry.coverAssetId)
      .then((bytes) => {
        if (!cancelled && bytes) {
          setUri(`data:${entry.coverMediaType};base64,${base64Of(bytes)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry.coverAssetId, entry.coverMediaType, entry.id]);

  const size = useMemo(
    () => fittedCoverSize(ratio, maximumWidth, maximumHeight),
    [maximumHeight, maximumWidth, ratio],
  );

  return (
    <View
      style={[
        styles.coverShadow,
        size,
        Platform.OS === "web"
          ? { boxShadow: `0 9px 18px ${theme.shadow}2a` }
          : {
              elevation: 5,
              shadowColor: theme.shadow,
            },
      ]}
    >
      {uri ? (
        <Image
          accessibilityLabel={`${entry.title} 封面`}
          onLoad={({ nativeEvent }) => {
            const source = nativeEvent.source;
            if (source?.width > 0 && source.height > 0) {
              setRatio(source.width / source.height);
            }
          }}
          resizeMode="contain"
          source={{ uri }}
          style={[styles.coverImage, size]}
        />
      ) : (
        <View
          style={[
            styles.fallbackCover,
            size,
            { backgroundColor: theme.imagePlaceholder },
          ]}
        >
          <Text style={[styles.fallbackMark, { color: theme.accent }]}>柿</Text>
          <Text
            numberOfLines={4}
            style={[styles.fallbackTitle, { color: theme.text }]}
          >
            {entry.title}
          </Text>
        </View>
      )}
    </View>
  );
}

function anchorFromEvent(event: GestureResponderEvent): BookMenuRect {
  const { pageX, pageY } = event.nativeEvent;
  return { x: pageX - 1, y: pageY - 1, width: 2, height: 2 };
}

export interface LibraryBookCardProps {
  readonly entry: LibraryBookSummary;
  readonly opening: boolean;
  readonly theme: ReaderTheme;
  readonly width: number;
  readonly onContextMenu: (
    entry: LibraryBookSummary,
    rect: BookMenuRect,
  ) => void;
  readonly onOpen: () => void;
}

export function LibraryBookCard({
  entry,
  opening,
  theme,
  width,
  onContextMenu,
  onOpen,
}: LibraryBookCardProps) {
  const longPressTriggered = useRef(false);
  const stageHeight = Math.round(width * 1.45);
  const status = readingStatusForEntry(entry);
  const progressPercent = readingProgressPercent(entry);
  const progressLabel =
    entry.status === "needs-reimport"
      ? "需要下载"
      : status === "finished"
        ? "已读"
        : status === "reading"
          ? `${progressPercent}%`
          : "新书";

  const openContextMenu = (event: GestureResponderEvent) => {
    onContextMenu(entry, anchorFromEvent(event));
  };

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityHint="长按可查看书籍操作"
        accessibilityLabel={`打开 ${entry.title}`}
        accessibilityRole="button"
        disabled={opening}
        delayLongPress={360}
        onLongPress={(event) => {
          longPressTriggered.current = true;
          openContextMenu(event);
        }}
        onPress={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }
          if (entry.status === "ready") {
            onOpen();
          }
        }}
        onPressOut={() => {
          if (longPressTriggered.current) {
            setTimeout(() => {
              longPressTriggered.current = false;
            }, 0);
          }
        }}
        style={({ pressed }) => [
          styles.coverPressable,
          { height: stageHeight },
          pressed && styles.cardPressed,
        ]}
      >
        <View
          style={[
            styles.coverStage,
            { height: stageHeight, width },
            entry.status !== "ready" && styles.coverUnavailable,
          ]}
        >
          <BookCover
            entry={entry}
            maximumHeight={stageHeight}
            maximumWidth={width}
            theme={theme}
          />
          {opening ? (
            <View
              style={[
                styles.loadingOverlay,
                { backgroundColor: `${theme.panelRaised}d9` },
              ]}
            >
              <ActivityIndicator color={theme.accent} size="small" />
            </View>
          ) : null}
        </View>
      </Pressable>

      <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
        {entry.title}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.author, { color: theme.secondaryText }]}
      >
        {entry.author ?? "未知作者"}
      </Text>
      <View style={styles.metadataRow}>
        <Text
          numberOfLines={1}
          style={[
            styles.progress,
            {
              color:
                entry.status === "needs-reimport"
                  ? theme.noteAccent
                  : theme.secondaryText,
            },
          ]}
        >
          {progressLabel}
        </Text>
        <Pressable
          accessibilityLabel={`更多 ${entry.title} 操作`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={openContextMenu}
          style={({ pressed }) => [
            styles.moreButton,
            pressed && { backgroundColor: theme.panelMuted },
          ]}
        >
          <UiIcon color={theme.secondaryText} name="more" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  author: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  card: {
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  coverImage: {
    borderRadius: uiRadius.cover,
  },
  coverPressable: {
    justifyContent: "flex-end",
  },
  coverShadow: {
    backgroundColor: "transparent",
    borderRadius: uiRadius.cover,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  coverStage: {
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  coverUnavailable: {
    opacity: 0.58,
  },
  fallbackCover: {
    borderRadius: uiRadius.cover,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: uiSpace.md,
  },
  fallbackMark: {
    alignSelf: "flex-end",
    fontSize: 17,
    fontWeight: "700",
  },
  fallbackTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23,
  },
  loadingOverlay: {
    alignItems: "center",
    borderRadius: uiRadius.cover,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  metadataRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    minHeight: 28,
  },
  moreButton: {
    alignItems: "center",
    borderRadius: uiSpace.md,
    height: 28,
    justifyContent: "center",
    marginRight: -5,
    width: 34,
  },
  progress: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: uiSpace.sm + uiSpace.xxs + uiSpace.hairline,
    minHeight: 19,
  },
});
