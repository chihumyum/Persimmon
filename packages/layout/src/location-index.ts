import type { BookPosition } from "@persimmon/book-core";

import type {
  PageLocationIndex,
  PageScene,
  PageSceneItem,
} from "./types";

interface IndexedSpan {
  pageIndex: number;
  itemIndex: number;
  startOffset: number;
  endOffset: number;
}

function copyPosition(position: BookPosition): BookPosition {
  return { ...position };
}

export function createPageLocationIndex(
  pages: readonly PageScene[],
): PageLocationIndex {
  const spansByBlock = new Map<string, IndexedSpan[]>();

  pages.forEach((page) => {
    page.items.forEach((item, itemIndex) => {
      const key = `${item.sectionId}\u0000${item.blockId}`;
      const spans = spansByBlock.get(key) ?? [];
      spans.push({
        pageIndex: page.index,
        itemIndex,
        startOffset: item.source.startOffset,
        endOffset: item.source.endOffset,
      });
      spansByBlock.set(key, spans);
    });
  });

  for (const spans of spansByBlock.values()) {
    spans.sort(
      (left, right) =>
        left.startOffset - right.startOffset ||
        left.itemIndex - right.itemIndex ||
        left.pageIndex - right.pageIndex,
    );
  }

  return {
    pageFor(position) {
      const spans = spansByBlock.get(
        `${position.sectionId}\u0000${position.blockId}`,
      );
      if (!spans) {
        return undefined;
      }

      const containing = spans.find(
        (span) =>
          position.offset >= span.startOffset &&
          position.offset < span.endOffset,
      );
      if (containing) {
        return containing.pageIndex;
      }

      const ending = [...spans]
        .reverse()
        .find((span) => position.offset === span.endOffset);
      return ending?.pageIndex;
    },

    positionAtPageStart(pageIndex) {
      const page = pages[pageIndex];
      if (!page) {
        throw new RangeError(`page index ${pageIndex} is out of bounds`);
      }
      return copyPosition(page.start);
    },
  };
}

export function sourceSpanOf(item: PageSceneItem) {
  return item.source;
}
