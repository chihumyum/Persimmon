import {
  isTextBlock,
  textOf,
  type BookIR,
  type BookPosition,
} from "@persimmon/book-core";
import type {
  MeasuredParagraph,
  PageScene,
  PaginationResult,
  Rect,
} from "@persimmon/layout";

import { normalizeUtf16Boundary } from "./utf16";

export interface TextSelection {
  readonly anchor: BookPosition;
  readonly focus: BookPosition;
}

export interface NormalizedTextSelection {
  readonly start: BookPosition;
  readonly end: BookPosition;
}

export interface VisibleTextPage<THandle> {
  readonly page: PageScene;
  readonly pagination: PaginationResult<THandle>;
  readonly offsetX: number;
}

export interface TextSelectionRect extends Rect {
  readonly sectionId: string;
  readonly blockId: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface TextSelectionHandle {
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
}

export interface TextSelectionGeometry {
  readonly rects: readonly TextSelectionRect[];
  readonly bounds: Rect;
  readonly startHandle: TextSelectionHandle;
  readonly endHandle: TextSelectionHandle;
}

interface TextBlockEntry {
  readonly sectionId: string;
  readonly blockId: string;
  readonly text: string;
  readonly ordinal: number;
}

export interface TextSelectionDocument {
  readonly entries: readonly TextBlockEntry[];
  readonly entryByKey: ReadonlyMap<string, TextBlockEntry>;
}

interface WordSegment {
  readonly index: number;
  readonly segment: string;
  readonly isWordLike: boolean;
}

interface SegmenterPart {
  readonly index: number;
  readonly segment: string;
  readonly isWordLike?: boolean;
}

interface SegmenterLike {
  segment(text: string): Iterable<SegmenterPart>;
}

interface SegmenterConstructor {
  new (
    locale?: string,
    options?: { readonly granularity: "word" },
  ): SegmenterLike;
}

function blockKey(sectionId: string, blockId: string): string {
  return `${sectionId}\u0000${blockId}`;
}

export function createTextSelectionDocument(
  book: BookIR,
): TextSelectionDocument {
  const entries: TextBlockEntry[] = [];
  const entryByKey = new Map<string, TextBlockEntry>();

  for (const section of book.sections) {
    for (const block of section.blocks) {
      if (!isTextBlock(block)) {
        continue;
      }
      const entry = {
        sectionId: section.id,
        blockId: block.id,
        text: textOf(block),
        ordinal: entries.length,
      };
      entries.push(entry);
      entryByKey.set(blockKey(section.id, block.id), entry);
    }
  }

  return { entries, entryByKey };
}

function entryFor(
  document: TextSelectionDocument,
  position: BookPosition,
): TextBlockEntry {
  const entry = document.entryByKey.get(
    blockKey(position.sectionId, position.blockId),
  );
  if (!entry) {
    throw new RangeError(
      `text position points to an unknown block: ${position.sectionId}/${position.blockId}`,
    );
  }
  return entry;
}

export function compareTextPositions(
  document: TextSelectionDocument,
  left: BookPosition,
  right: BookPosition,
): number {
  const leftEntry = entryFor(document, left);
  const rightEntry = entryFor(document, right);
  return leftEntry.ordinal - rightEntry.ordinal || left.offset - right.offset;
}

export function normalizeTextSelection(
  document: TextSelectionDocument,
  selection: TextSelection,
): NormalizedTextSelection {
  return compareTextPositions(document, selection.anchor, selection.focus) <= 0
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor };
}

export function selectedText(
  document: TextSelectionDocument,
  selection: TextSelection,
): string {
  const { start, end } = normalizeTextSelection(document, selection);
  const startEntry = entryFor(document, start);
  const endEntry = entryFor(document, end);
  const fragments: string[] = [];

  for (
    let ordinal = startEntry.ordinal;
    ordinal <= endEntry.ordinal;
    ordinal += 1
  ) {
    const entry = document.entries[ordinal]!;
    const startOffset =
      ordinal === startEntry.ordinal
        ? normalizeUtf16Boundary(entry.text, start.offset, "backward")
        : 0;
    const endOffset =
      ordinal === endEntry.ordinal
        ? normalizeUtf16Boundary(entry.text, end.offset, "forward")
        : entry.text.length;
    const fragment = entry.text.slice(startOffset, endOffset);
    if (fragment.length > 0) {
      fragments.push(fragment);
    }
  }

  return fragments.join("\n\n");
}

function segmenterWords(text: string, locale?: string): WordSegment[] | null {
  const Segmenter = (
    Intl as typeof Intl & { readonly Segmenter?: SegmenterConstructor }
  ).Segmenter;
  if (!Segmenter) {
    return null;
  }

  try {
    return [
      ...new Segmenter(locale, { granularity: "word" }).segment(text),
    ].map((part) => ({
      index: part.index,
      segment: part.segment,
      isWordLike: part.isWordLike ?? true,
    }));
  } catch {
    return null;
  }
}

function scalarKind(scalar: string): "space" | "punctuation" | "cjk" | "word" {
  if (/^\s$/u.test(scalar)) {
    return "space";
  }
  if (/^[\p{P}\p{S}]$/u.test(scalar)) {
    return "punctuation";
  }
  if (
    /^(?:\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul})$/u.test(
      scalar,
    )
  ) {
    return "cjk";
  }
  return "word";
}

function fallbackWords(text: string): WordSegment[] {
  const segments: WordSegment[] = [];
  let offset = 0;

  for (const scalar of text) {
    const kind = scalarKind(scalar);
    const previous = segments.at(-1);
    const canJoinPrevious =
      previous &&
      kind === "word" &&
      previous.isWordLike &&
      scalarKind(previous.segment.at(-1)!) === "word";

    if (canJoinPrevious) {
      segments[segments.length - 1] = {
        ...previous,
        segment: previous.segment + scalar,
      };
    } else {
      segments.push({
        index: offset,
        segment: scalar,
        isWordLike: kind === "word" || kind === "cjk",
      });
    }
    offset += scalar.length;
  }

  return segments;
}

function segmentDistance(segment: WordSegment, offset: number): number {
  const end = segment.index + segment.segment.length;
  if (offset < segment.index) {
    return segment.index - offset;
  }
  if (offset > end) {
    return offset - end;
  }
  return 0;
}

export function wordRangeAt(
  text: string,
  rawOffset: number,
  locale?: string,
): readonly [startOffset: number, endOffset: number] | undefined {
  if (text.length === 0) {
    return undefined;
  }

  const offset = Math.min(
    text.length - 1,
    normalizeUtf16Boundary(text, rawOffset, "backward"),
  );
  const segments = segmenterWords(text, locale) ?? fallbackWords(text);
  const containing = segments.find(
    (segment) =>
      segment.index <= offset &&
      offset < segment.index + segment.segment.length,
  );
  const selected =
    (containing?.isWordLike ? containing : undefined) ??
    segments
      .filter((segment) => segment.isWordLike)
      .sort(
        (left, right) =>
          segmentDistance(left, offset) - segmentDistance(right, offset),
      )[0] ??
    containing;

  if (!selected) {
    return undefined;
  }
  return [
    normalizeUtf16Boundary(text, selected.index, "backward"),
    normalizeUtf16Boundary(
      text,
      selected.index + selected.segment.length,
      "forward",
    ),
  ];
}

export function wordSelectionAt(
  document: TextSelectionDocument,
  position: BookPosition,
  locale?: string,
): TextSelection | undefined {
  const entry = entryFor(document, position);
  const range = wordRangeAt(entry.text, position.offset, locale);
  if (!range) {
    return undefined;
  }
  return {
    anchor: { ...position, offset: range[0] },
    focus: { ...position, offset: range[1] },
  };
}

function distanceToRect(x: number, y: number, rect: Rect): number {
  const dx =
    x < rect.x
      ? rect.x - x
      : x > rect.x + rect.width
        ? x - (rect.x + rect.width)
        : 0;
  const dy =
    y < rect.y
      ? rect.y - y
      : y > rect.y + rect.height
        ? y - (rect.y + rect.height)
        : 0;
  return dx * dx + dy * dy;
}

export function hitTestVisibleText<THandle>(
  pages: readonly VisibleTextPage<THandle>[],
  x: number,
  y: number,
  nearest = false,
): BookPosition | undefined {
  let closest:
    | {
        readonly page: VisibleTextPage<THandle>;
        readonly item: Extract<
          PageScene["items"][number],
          { kind: "paragraph-slice" }
        >;
        readonly score: number;
      }
    | undefined;

  for (const page of pages) {
    for (const item of page.page.items) {
      if (item.kind !== "paragraph-slice") {
        continue;
      }
      const frame = { ...item.frame, x: item.frame.x + page.offsetX };
      const score = distanceToRect(x, y, frame);
      if (score === 0) {
        closest = { page, item, score };
        break;
      }
      if (nearest && (!closest || score < closest.score)) {
        closest = { page, item, score };
      }
    }
    if (closest?.score === 0) {
      break;
    }
  }

  if (!closest) {
    return undefined;
  }
  const paragraph = closest.page.pagination.paragraphs.get(
    closest.item.paragraphKey,
  );
  if (!paragraph) {
    return undefined;
  }
  const offset = paragraph.hitTest(
    x - closest.page.offsetX - closest.item.frame.x,
    y - closest.item.frame.y + closest.item.sourceTop,
  );
  return {
    sectionId: closest.item.sectionId,
    blockId: closest.item.blockId,
    offset: Math.min(
      closest.item.source.endOffset,
      Math.max(closest.item.source.startOffset, offset),
    ),
  };
}

function selectedOffsetsForItem(
  document: TextSelectionDocument,
  selection: NormalizedTextSelection,
  item: Extract<PageScene["items"][number], { kind: "paragraph-slice" }>,
): readonly [startOffset: number, endOffset: number] | undefined {
  const itemEntry = document.entryByKey.get(
    blockKey(item.sectionId, item.blockId),
  );
  if (!itemEntry) {
    return undefined;
  }
  const startEntry = entryFor(document, selection.start);
  const endEntry = entryFor(document, selection.end);
  if (
    itemEntry.ordinal < startEntry.ordinal ||
    itemEntry.ordinal > endEntry.ordinal
  ) {
    return undefined;
  }

  const startOffset = Math.max(
    item.source.startOffset,
    itemEntry.ordinal === startEntry.ordinal ? selection.start.offset : 0,
  );
  const endOffset = Math.min(
    item.source.endOffset,
    itemEntry.ordinal === endEntry.ordinal
      ? selection.end.offset
      : itemEntry.text.length,
  );
  return startOffset < endOffset ? [startOffset, endOffset] : undefined;
}

function intersectRect(left: Rect, right: Rect): Rect | undefined {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return rightEdge > x && bottomEdge > y
    ? { x, y, width: rightEdge - x, height: bottomEdge - y }
    : undefined;
}

function translatedSelectionRects<THandle>(
  paragraph: MeasuredParagraph<THandle>,
  page: VisibleTextPage<THandle>,
  item: Extract<PageScene["items"][number], { kind: "paragraph-slice" }>,
  startOffset: number,
  endOffset: number,
): TextSelectionRect[] {
  const clip = { ...item.frame, x: item.frame.x + page.offsetX };
  return paragraph
    .rectsForRange(startOffset, endOffset)
    .map((rect) => ({
      x: rect.x + item.frame.x + page.offsetX,
      y: rect.y + item.frame.y - item.sourceTop,
      width: rect.width,
      height: rect.height,
    }))
    .map((rect) => intersectRect(rect, clip))
    .filter((rect): rect is Rect => rect !== undefined)
    .map((rect) => ({
      ...rect,
      sectionId: item.sectionId,
      blockId: item.blockId,
      startOffset,
      endOffset,
    }));
}

function boundingRect(rects: readonly Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function textSelectionGeometry<THandle>(
  document: TextSelectionDocument,
  selection: TextSelection,
  pages: readonly VisibleTextPage<THandle>[],
): TextSelectionGeometry | undefined {
  const normalized = normalizeTextSelection(document, selection);
  if (compareTextPositions(document, normalized.start, normalized.end) === 0) {
    return undefined;
  }

  const rects: TextSelectionRect[] = [];
  for (const page of pages) {
    for (const item of page.page.items) {
      if (item.kind !== "paragraph-slice") {
        continue;
      }
      const offsets = selectedOffsetsForItem(document, normalized, item);
      if (!offsets) {
        continue;
      }
      const paragraph = page.pagination.paragraphs.get(item.paragraphKey);
      if (!paragraph) {
        continue;
      }
      rects.push(
        ...translatedSelectionRects(
          paragraph,
          page,
          item,
          offsets[0],
          offsets[1],
        ),
      );
    }
  }

  const first = rects[0];
  const last = rects.at(-1);
  if (!first || !last) {
    return undefined;
  }
  return {
    rects,
    bounds: boundingRect(rects),
    startHandle: {
      x: first.x,
      top: first.y,
      bottom: first.y + first.height,
    },
    endHandle: {
      x: last.x + last.width,
      top: last.y,
      bottom: last.y + last.height,
    },
  };
}
