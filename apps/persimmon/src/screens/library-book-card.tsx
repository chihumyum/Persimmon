import type { ReaderTheme } from "@persimmon/reader-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useTranslation } from "react-i18next";

import { LibraryNativeToolbarButton } from "../components/library-native-toolbar-button";
import { uiRadius, uiSpace } from "../components/ui-tokens";
import { formatPercentage } from "../i18n";
import {
  libraryCoverCache,
  libraryCoverCacheKey,
  type CachedLibraryCover,
} from "../library/library-cover-cache";
import {
  isNewLibraryEntry,
  readingProgressPercent,
  readingStatusForEntry,
} from "../library/library-view";
import {
  libraryRepository,
  type LibraryBookSummary,
} from "../library/repository";
import type { BookMenuRect } from "../../modules/persimmon-selection-menu";

const DEFAULT_COVER_RATIO = 0.7;

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
  const { t } = useTranslation();
  const coverAssetId = entry.coverAssetId;
  const coverMediaType = entry.coverMediaType;
  const cacheKey =
    coverAssetId && coverMediaType
      ? libraryCoverCacheKey(entry.id, coverAssetId, coverMediaType)
      : undefined;
  const [cover, setCover] = useState<CachedLibraryCover | undefined>(() =>
    cacheKey ? libraryCoverCache.peek(cacheKey) : undefined,
  );

  useEffect(() => {
    if (!cacheKey || !coverAssetId || !coverMediaType) {
      setCover(undefined);
      return;
    }
    const cached = libraryCoverCache.peek(cacheKey);
    if (cached) {
      setCover(cached);
      return;
    }
    setCover(undefined);
    let cancelled = false;
    void libraryCoverCache
      .load(cacheKey, coverMediaType, () =>
        libraryRepository.getResource(entry.id, coverAssetId),
      )
      .then((loadedCover) => {
        if (!cancelled && loadedCover) {
          setCover(loadedCover);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCover(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, coverAssetId, coverMediaType, entry.id]);

  const ratio = cover?.ratio ?? DEFAULT_COVER_RATIO;

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
      {cover ? (
        <Image
          accessibilityLabel={t("library.card.coverAccessibility", {
            title: entry.title,
          })}
          onLoad={({ nativeEvent }) => {
            const source = nativeEvent.source;
            if (source?.width > 0 && source.height > 0) {
              const nextRatio = source.width / source.height;
              setCover((current) =>
                current ? { ...current, ratio: nextRatio } : current,
              );
              if (cacheKey) {
                libraryCoverCache.rememberRatio(cacheKey, nextRatio);
              }
            }
          }}
          resizeMode="contain"
          source={{ uri: cover.uri }}
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
  readonly bookMetadataVisible: boolean;
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
  bookMetadataVisible,
  entry,
  opening,
  theme,
  width,
  onContextMenu,
  onOpen,
}: LibraryBookCardProps) {
  const { t } = useTranslation();
  const longPressTriggered = useRef(false);
  const moreAnchorRef = useRef<View>(null);
  const stageHeight = Math.round(width * 1.45);
  const status = readingStatusForEntry(entry);
  const isNew = isNewLibraryEntry(entry);
  const progressPercent = readingProgressPercent(entry);
  const progressLabel =
    entry.status === "needs-reimport"
      ? t("library.card.needsDownload")
      : status === "finished"
        ? t("library.card.finished")
        : status === "reading"
          ? formatPercentage(progressPercent)
          : t("library.card.unread");

  const openContextMenu = (event: GestureResponderEvent) => {
    onContextMenu(entry, anchorFromEvent(event));
  };
  const openContextMenuFromButton = () => {
    moreAnchorRef.current?.measureInWindow((x, y, measuredWidth, height) => {
      onContextMenu(entry, {
        x,
        y,
        width: Math.max(measuredWidth, 2),
        height: Math.max(height, 2),
      });
    });
  };

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityHint={t("library.card.longPressHint")}
        accessibilityLabel={t("library.card.openAccessibility", {
          title: entry.title,
        })}
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
        style={[styles.coverPressable, { height: stageHeight }]}
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
        </View>
      </Pressable>

      {bookMetadataVisible ? (
        <>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {entry.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.author, { color: theme.secondaryText }]}
          >
            {entry.author ?? t("common.unknownAuthor")}
          </Text>
        </>
      ) : null}
      <View
        style={[
          styles.metadataRow,
          !bookMetadataVisible && styles.metadataRowWithoutBookInfo,
        ]}
      >
        {isNew ? (
          <View style={[styles.newBadge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.newBadgeText, { color: theme.panelRaised }]}>
              {t("library.card.new")}
            </Text>
          </View>
        ) : (
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
        )}
        <View collapsable={false} ref={moreAnchorRef} style={styles.moreButton}>
          <LibraryNativeToolbarButton
            accessibilityLabel={t("library.card.moreAccessibility", {
              title: entry.title,
            })}
            compact
            icon="more"
            plain
            onPress={openContextMenuFromButton}
            theme={theme}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  author: {
    fontFamily: Platform.select({ android: "sans-serif", ios: "System" }),
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  card: {
    minWidth: 0,
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
    fontFamily: Platform.select({ android: "sans-serif", ios: "System" }),
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23,
  },
  metadataRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    minHeight: 28,
  },
  metadataRowWithoutBookInfo: {
    marginTop: uiSpace.sm,
  },
  moreButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    marginRight: -7,
    width: 40,
  },
  newBadge: {
    borderRadius: uiRadius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontFamily: Platform.select({ android: "sans-serif", ios: "System" }),
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: 12,
  },
  progress: {
    flex: 1,
    fontFamily: Platform.select({ android: "sans-serif", ios: "System" }),
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  title: {
    fontFamily: Platform.select({ android: "sans-serif", ios: "System" }),
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: uiSpace.sm + uiSpace.xxs + uiSpace.hairline,
    minHeight: 38,
  },
});
