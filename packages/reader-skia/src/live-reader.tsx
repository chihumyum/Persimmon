import type {
  BookIR,
  BookLocator,
  BookPosition,
} from "@persimmon/book-core";
import {
  createDefaultPageLayoutSpec,
  paginateBook,
  ReaderSession,
  type PageLayoutSpec,
  type PageScene,
  type PaginationResult,
  type ReaderSnapshot,
} from "@persimmon/layout";
import {
  Canvas,
  Fill,
  Group,
  Paragraph,
  RoundedRect,
  type SkParagraph,
  type SkTypefaceFontProvider,
  type Transforms3d,
} from "@shopify/react-native-skia";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  runOnJS,
  type DerivedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { createSkiaParagraphBackend } from "./skia-paragraph-backend";

export interface ReaderProgress {
  locator: BookLocator;
  pageIndex: number;
  pageCount: number;
}

export interface LiveReaderProps {
  book: BookIR;
  fontProvider: SkTypefaceFontProvider;
  width: number;
  height: number;
  fontSize?: number;
  initialPosition?: BookPosition;
  onProgress?: (progress: ReaderProgress) => void;
}

interface PageLayerProps {
  page: PageScene;
  pagination: PaginationResult<SkParagraph>;
  translateX?: DerivedValue<Transforms3d>;
}

interface SessionView {
  session: ReaderSession;
  snapshot: ReaderSnapshot;
}

function PageLayer({
  page,
  pagination,
  translateX,
}: PageLayerProps) {
  return (
    <Group transform={translateX}>
      {page.items.map((item, itemIndex) => {
        if (item.kind === "image") {
          return (
            <RoundedRect
              key={`${item.blockId}:${itemIndex}`}
              x={item.frame.x}
              y={item.frame.y}
              width={item.frame.width}
              height={item.frame.height}
              r={18}
              color="#eed9c8"
            />
          );
        }

        const measured = pagination.paragraphs.get(
          item.paragraphKey,
        );
        if (!measured) {
          return null;
        }

        return (
          <Group
            key={`${item.blockId}:${item.source.startOffset}`}
            clip={item.frame}
          >
            <Paragraph
              paragraph={measured.handle}
              x={item.frame.x}
              y={item.frame.y - item.sourceTop}
              width={item.frame.width}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function scaledLayoutSpec(
  width: number,
  height: number,
  fontSize: number,
): PageLayoutSpec {
  const spec = createDefaultPageLayoutSpec({ width, height });
  const scale = fontSize / spec.body.fontSize;
  return {
    ...spec,
    body: { ...spec.body, fontSize },
    headings: {
      1: {
        ...spec.headings[1],
        fontSize: spec.headings[1].fontSize * scale,
      },
      2: {
        ...spec.headings[2],
        fontSize: spec.headings[2].fontSize * scale,
      },
      3: {
        ...spec.headings[3],
        fontSize: spec.headings[3].fontSize * scale,
      },
    },
  };
}

function initialPageFor(
  pagination: PaginationResult<SkParagraph>,
  position: BookPosition | undefined,
): number {
  if (!position) {
    return 0;
  }
  return pagination.locationIndex.pageFor(position) ?? 0;
}

export function LiveReader({
  book,
  fontProvider,
  width,
  height,
  fontSize = 20,
  initialPosition,
  onProgress,
}: LiveReaderProps) {
  const backend = useMemo(
    () => createSkiaParagraphBackend(fontProvider),
    [fontProvider],
  );
  const spec = useMemo(
    () => scaledLayoutSpec(width, height, fontSize),
    [fontSize, height, width],
  );
  const pagination = useMemo(
    () => paginateBook(book, spec, backend),
    [backend, book, spec],
  );
  const anchorRef = useRef<BookPosition | undefined>(initialPosition);
  const session = useMemo(
    () =>
      new ReaderSession(
        pagination.pages.length,
        initialPageFor(pagination, anchorRef.current),
      ),
    [pagination],
  );
  const [sessionView, setSessionView] = useState<SessionView>(() => ({
    session,
    snapshot: session.getSnapshot(),
  }));
  const snapshot =
    sessionView.session === session
      ? sessionView.snapshot
      : session.getSnapshot();

  const progress = useSharedValue(0);
  const direction = useSharedValue<1 | -1>(1);
  const pageWidth = useSharedValue(width);

  useEffect(() => {
    pageWidth.value = width;
  }, [pageWidth, width]);

  useEffect(() => {
    setSessionView({
      session,
      snapshot: session.getSnapshot(),
    });
    return session.subscribe((nextSnapshot) => {
      setSessionView({ session, snapshot: nextSnapshot });
    });
  }, [session]);

  useEffect(
    () => () => {
      for (const paragraph of pagination.paragraphs.values()) {
        paragraph.handle.dispose();
      }
    },
    [pagination],
  );

  const settleTransition = useCallback(
    (transitionId: string) => {
      session.settleTransition(transitionId);
    },
    [session],
  );

  const activeTransition = snapshot.activeTransition;
  const activeTransitionId = activeTransition?.id;

  useEffect(() => {
    if (
      !activeTransitionId &&
      snapshot.desiredPage !== snapshot.settledPage
    ) {
      session.beginTransition();
    }
  }, [
    activeTransitionId,
    session,
    snapshot.desiredPage,
    snapshot.settledPage,
  ]);

  useEffect(() => {
    if (!activeTransition) {
      return;
    }

    direction.value = activeTransition.direction;
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: activeTransition.coalesced ? 130 : 180 },
      (finished) => {
        "worklet";
        if (finished) {
          runOnJS(settleTransition)(activeTransition.id);
        }
      },
    );
    // The transition id is the animation identity. Changes to desiredPage
    // intentionally do not restart the active animation.
  }, [
    activeTransitionId,
    direction,
    progress,
    settleTransition,
  ]);

  useEffect(() => {
    if (snapshot.activeTransition) {
      return;
    }
    const page = pagination.pages[snapshot.settledPage];
    if (!page) {
      return;
    }
    anchorRef.current = page.start;
    onProgress?.({
      locator: {
        bookId: book.id,
        revisionId: book.revisionId,
        position: page.start,
        affinity: "forward",
      },
      pageIndex: snapshot.settledPage,
      pageCount: pagination.pages.length,
    });
  }, [
    book.id,
    book.revisionId,
    onProgress,
    pagination.pages,
    snapshot.activeTransition,
    snapshot.settledPage,
  ]);

  const currentTransform = useDerivedValue<Transforms3d>(() => [
    {
      translateX:
        -direction.value * progress.value * pageWidth.value,
    },
  ]);
  const targetTransform = useDerivedValue<Transforms3d>(() => [
    {
      translateX:
        direction.value *
        (pageWidth.value - progress.value * pageWidth.value),
    },
  ]);

  const active = activeTransition;
  const settledPage = pagination.pages[snapshot.settledPage]!;
  const targetPage = active
    ? pagination.pages[active.toPage]
    : undefined;
  const shownPage = snapshot.settledPage + 1;
  const targetNumber = snapshot.desiredPage + 1;
  const pageCount = pagination.pages.length;

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Fill color="#fbf7f0" />
        <PageLayer
          page={settledPage}
          pagination={pagination}
          translateX={active ? currentTransform : undefined}
        />
        {targetPage ? (
          <PageLayer
            page={targetPage}
            pagination={pagination}
            translateX={targetTransform}
          />
        ) : null}
      </Canvas>

      <Pressable
        accessibilityLabel="上一页"
        accessibilityRole="button"
        disabled={snapshot.desiredPage === 0}
        onPress={() => session.previous()}
        style={[styles.edge, styles.leftEdge]}
      />
      <Pressable
        accessibilityLabel="下一页"
        accessibilityRole="button"
        disabled={snapshot.desiredPage === pageCount - 1}
        onPress={() => session.next()}
        style={[styles.edge, styles.rightEdge]}
      />

      <View
        accessibilityLabel={`第 ${shownPage} 页，共 ${pageCount} 页，目标第 ${targetNumber} 页`}
        accessibilityLiveRegion="polite"
        pointerEvents="none"
        style={styles.pageBadge}
      >
        <Text style={styles.pageText}>
          {shownPage} / {pageCount}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  container: {
    backgroundColor: "#fbf7f0",
    flex: 1,
    overflow: "hidden",
  },
  edge: {
    bottom: 0,
    position: "absolute",
    top: 0,
    width: "24%",
  },
  leftEdge: {
    left: 0,
  },
  pageBadge: {
    alignItems: "center",
    bottom: 14,
    left: 0,
    position: "absolute",
    right: 0,
  },
  pageText: {
    color: "#8b8177",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
  rightEdge: {
    right: 0,
  },
});
