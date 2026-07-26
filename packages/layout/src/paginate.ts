import {
  assertValidBookIR,
  isTextBlock,
  textOf,
  type BlockIR,
  type BookIR,
  type ImageBlockIR,
  type SectionIR,
  type TextBlockIR,
} from "@persimmon/book-core";

import { createPageLocationIndex } from "./location-index";
import type {
  MeasuredLine,
  MeasuredParagraph,
  PageLayoutSpec,
  PageLinkRegion,
  PageScene,
  PageSceneItem,
  PaginationResult,
  ParagraphLayoutBackend,
  Rect,
  ResolvedRun,
  TypographyPreset,
} from "./types";

const EPSILON = 0.001;

interface FlowBlock {
  sectionId: string;
  block: BlockIR;
}

interface MutablePage {
  items: PageSceneItem[];
  links: PageLinkRegion[];
  cursorY: number;
  previousBlock: BlockIR | undefined;
}

const validatedBooks = new WeakSet<object>();

function assertValidBookOnce(book: BookIR): void {
  if (validatedBooks.has(book)) {
    return;
  }
  assertValidBookIR(book);
  validatedBooks.add(book);
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number`);
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}

function validateLayoutSpec(spec: PageLayoutSpec): Rect {
  assertFinitePositive(spec.viewport.width, "viewport.width");
  assertFinitePositive(spec.viewport.height, "viewport.height");
  assertFiniteNonNegative(spec.padding.top, "padding.top");
  assertFiniteNonNegative(spec.padding.right, "padding.right");
  assertFiniteNonNegative(spec.padding.bottom, "padding.bottom");
  assertFiniteNonNegative(spec.padding.left, "padding.left");
  assertFiniteNonNegative(spec.paragraphGap, "paragraphGap");
  assertFiniteNonNegative(spec.headingBefore, "headingBefore");
  assertFiniteNonNegative(spec.headingAfter, "headingAfter");
  assertFiniteNonNegative(spec.imageGap, "imageGap");

  if (
    !Number.isFinite(spec.imageMaxHeightRatio) ||
    spec.imageMaxHeightRatio <= 0 ||
    spec.imageMaxHeightRatio > 1
  ) {
    throw new RangeError("imageMaxHeightRatio must be in the range (0, 1]");
  }

  if (
    !Number.isInteger(spec.minBodyLinesAfterHeading) ||
    spec.minBodyLinesAfterHeading < 0
  ) {
    throw new RangeError(
      "minBodyLinesAfterHeading must be a non-negative integer",
    );
  }

  const width = spec.viewport.width - spec.padding.left - spec.padding.right;
  const height = spec.viewport.height - spec.padding.top - spec.padding.bottom;
  assertFinitePositive(width, "content width");
  assertFinitePositive(height, "content height");

  return {
    x: spec.padding.left,
    y: spec.padding.top,
    width,
    height,
  };
}

function styleForBlock(
  block: TextBlockIR,
  spec: PageLayoutSpec,
): TypographyPreset {
  const base =
    block.kind === "heading"
      ? spec.headings[block.level]
      : block.noteKind
        ? spec.note
        : spec.body;
  return {
    ...base,
    ...(block.style?.textAlign ? { align: block.style.textAlign } : {}),
    ...(block.style?.fontWeight ? { weight: block.style.fontWeight } : {}),
    ...(block.style?.fontStyle ? { style: block.style.fontStyle } : {}),
  };
}

function resolveRuns(block: TextBlockIR): readonly ResolvedRun[] {
  let offset = 0;
  return block.runs.map((run) => {
    const startOffset = offset;
    offset += run.text.length;
    return {
      text: run.text,
      startOffset,
      endOffset: offset,
      marks: run.marks ?? [],
      ...(run.verticalAlign ? { verticalAlign: run.verticalAlign } : {}),
      ...(run.link ? { link: run.link } : {}),
    };
  });
}

function intersectRect(left: Rect, right: Rect): Rect | undefined {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) {
    return undefined;
  }
  return {
    x,
    y,
    width: rightEdge - x,
    height: bottomEdge - y,
  };
}

function linkRegionsForSlice<THandle>(
  item: Extract<PageSceneItem, { kind: "paragraph-slice" }>,
  measured: MeasuredParagraph<THandle>,
  runs: readonly ResolvedRun[],
): PageLinkRegion[] {
  const regions: PageLinkRegion[] = [];
  for (const run of runs) {
    if (!run.link) {
      continue;
    }
    const startOffset = Math.max(run.startOffset, item.source.startOffset);
    const endOffset = Math.min(run.endOffset, item.source.endOffset);
    if (endOffset <= startOffset) {
      continue;
    }
    for (const rect of measured.rectsForRange(startOffset, endOffset)) {
      const clipped = intersectRect(
        {
          x: item.frame.x + rect.x,
          y: item.frame.y - item.sourceTop + rect.y,
          width: rect.width,
          height: rect.height,
        },
        item.frame,
      );
      if (!clipped) {
        continue;
      }
      regions.push({
        source: {
          sectionId: item.sectionId,
          blockId: item.blockId,
          offset: startOffset,
        },
        link: run.link,
        frame: clipped,
      });
    }
  }
  return regions;
}

function paragraphKey(
  book: BookIR,
  sectionId: string,
  block: TextBlockIR,
  width: number,
  style: TypographyPreset,
): string {
  return JSON.stringify([
    book.id,
    book.revisionId,
    sectionId,
    block.id,
    width,
    style,
  ]);
}

function validateMeasuredParagraph<THandle>(
  paragraph: MeasuredParagraph<THandle>,
  expectedKey: string,
  text: string,
): void {
  if (paragraph.key !== expectedKey) {
    throw new Error(
      `paragraph backend returned key ${paragraph.key}, expected ${expectedKey}`,
    );
  }
  if (paragraph.lines.length === 0) {
    throw new Error(`paragraph ${expectedKey} has no measured lines`);
  }

  let expectedOffset = 0;
  let previousTop = Number.NEGATIVE_INFINITY;
  for (const [lineIndex, line] of paragraph.lines.entries()) {
    if (
      !Number.isInteger(line.startOffset) ||
      !Number.isInteger(line.endOffset) ||
      line.startOffset !== expectedOffset ||
      line.endOffset <= line.startOffset ||
      line.endOffset > text.length
    ) {
      throw new Error(
        `paragraph ${expectedKey} line ${lineIndex} does not provide contiguous UTF-16 offsets`,
      );
    }
    if (
      line.visibleEndOffset < line.startOffset ||
      line.visibleEndOffset > line.endOffset
    ) {
      throw new Error(
        `paragraph ${expectedKey} line ${lineIndex} has an invalid visible end`,
      );
    }
    if (
      !Number.isFinite(line.top) ||
      !Number.isFinite(line.bottom) ||
      !Number.isFinite(line.baseline) ||
      line.top < previousTop ||
      line.bottom <= line.top
    ) {
      throw new Error(
        `paragraph ${expectedKey} line ${lineIndex} has invalid geometry`,
      );
    }

    expectedOffset = line.endOffset;
    previousTop = line.top;
  }

  if (expectedOffset !== text.length) {
    throw new Error(
      `paragraph ${expectedKey} lines end at ${expectedOffset}, expected ${text.length} UTF-16 code units`,
    );
  }
}

function gapBefore(
  block: BlockIR,
  previousBlock: BlockIR | undefined,
  spec: PageLayoutSpec,
): number {
  if (
    spec.paragraphGapMode === "reader" &&
    block.kind === "paragraph" &&
    previousBlock?.kind === "paragraph"
  ) {
    return spec.paragraphGap;
  }

  const currentMargin = block.style?.marginBeforeEm;
  const previousMargin = previousBlock?.style?.marginAfterEm;
  if (currentMargin !== undefined || previousMargin !== undefined) {
    const currentFontSize =
      block.kind === "image"
        ? spec.body.fontSize
        : styleForBlock(block, spec).fontSize;
    const previousFontSize =
      !previousBlock || previousBlock.kind === "image"
        ? spec.body.fontSize
        : styleForBlock(previousBlock, spec).fontSize;
    return Math.max(
      (currentMargin ?? 0) * currentFontSize,
      (previousMargin ?? 0) * previousFontSize,
    );
  }
  if (!previousBlock) {
    return 0;
  }
  if (previousBlock.kind === "heading") {
    return spec.headingAfter;
  }
  if (block.kind === "heading") {
    return spec.headingBefore;
  }
  if (block.kind === "image" || previousBlock.kind === "image") {
    return spec.imageGap;
  }
  return spec.paragraphGap;
}

function lineSliceHeight(
  lines: readonly MeasuredLine[],
  startIndex: number,
  endIndexInclusive: number,
): number {
  return lines[endIndexInclusive]!.bottom - lines[startIndex]!.top;
}

function lastFittingLine(
  lines: readonly MeasuredLine[],
  startIndex: number,
  availableHeight: number,
): number | undefined {
  let result: number | undefined;
  for (let index = startIndex; index < lines.length; index += 1) {
    if (
      lineSliceHeight(lines, startIndex, index) <=
      availableHeight + EPSILON
    ) {
      result = index;
    } else {
      break;
    }
  }
  return result;
}

function paragraphHeight<THandle>(
  paragraph: MeasuredParagraph<THandle>,
): number {
  const first = paragraph.lines[0]!;
  const last = paragraph.lines.at(-1)!;
  return last.bottom - first.top;
}

function firstLinesHeight<THandle>(
  paragraph: MeasuredParagraph<THandle>,
  count: number,
): number {
  if (count === 0) {
    return 0;
  }
  const lastIndex = Math.min(count, paragraph.lines.length) - 1;
  return lineSliceHeight(paragraph.lines, 0, lastIndex);
}

function imageFrame(
  block: ImageBlockIR,
  contentRect: Rect,
  maxHeightRatio: number,
  y: number,
): Rect {
  const aspectRatio = block.intrinsicSize
    ? block.intrinsicSize.width / block.intrinsicSize.height
    : 4 / 3;
  const maxHeight = contentRect.height * maxHeightRatio;

  let width = contentRect.width;
  let height = width / aspectRatio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    x: contentRect.x + (contentRect.width - width) / 2,
    y,
    width,
    height,
  };
}

function paginateSections<THandle>(
  book: BookIR,
  sections: readonly SectionIR[],
  spec: PageLayoutSpec,
  backend: ParagraphLayoutBackend<THandle>,
): PaginationResult<THandle> {
  const contentRect = validateLayoutSpec(spec);
  const contentBottom = contentRect.y + contentRect.height;
  const flow: FlowBlock[] = sections.flatMap((section) =>
    section.blocks.map((block) => ({ sectionId: section.id, block })),
  );
  const paragraphs = new Map<string, MeasuredParagraph<THandle>>();
  const pages: PageScene[] = [];

  let page: MutablePage = {
    items: [],
    links: [],
    cursorY: contentRect.y,
    previousBlock: undefined,
  };

  const flushPage = (): void => {
    if (page.items.length === 0) {
      return;
    }

    const first = page.items[0]!;
    const last = page.items.at(-1)!;
    pages.push({
      index: pages.length,
      size: { ...spec.viewport },
      contentRect: { ...contentRect },
      items: page.items,
      ...(page.links.length > 0 ? { links: page.links } : {}),
      start: {
        sectionId: first.sectionId,
        blockId: first.blockId,
        offset: first.source.startOffset,
      },
      end: {
        sectionId: last.sectionId,
        blockId: last.blockId,
        offset: last.source.endOffset,
      },
    });
    page = {
      items: [],
      links: [],
      cursorY: contentRect.y,
      previousBlock: undefined,
    };
  };

  const measuredFor = (
    sectionId: string,
    block: TextBlockIR,
  ): MeasuredParagraph<THandle> => {
    const style = styleForBlock(block, spec);
    const key = paragraphKey(book, sectionId, block, contentRect.width, style);
    const cached = paragraphs.get(key);
    if (cached) {
      return cached;
    }

    const text = textOf(block);
    const measured = backend.layout({
      key,
      text,
      runs: resolveRuns(block),
      width: contentRect.width,
      style,
    });
    validateMeasuredParagraph(measured, key, text);
    paragraphs.set(key, measured);
    return measured;
  };

  for (let flowIndex = 0; flowIndex < flow.length; flowIndex += 1) {
    const entry = flow[flowIndex]!;
    const { block, sectionId } = entry;

    if (isTextBlock(block)) {
      const measured = measuredFor(sectionId, block);

      if (block.kind === "heading" && page.items.length > 0) {
        const nextEntry = flow[flowIndex + 1];
        const nextParagraph =
          nextEntry &&
          nextEntry.sectionId === sectionId &&
          nextEntry.block.kind === "paragraph"
            ? measuredFor(nextEntry.sectionId, nextEntry.block)
            : undefined;
        const before = gapBefore(block, page.previousBlock, spec);
        const keepHeight =
          before +
          paragraphHeight(measured) +
          (nextParagraph
            ? spec.headingAfter +
              firstLinesHeight(nextParagraph, spec.minBodyLinesAfterHeading)
            : 0);

        if (
          keepHeight <= contentRect.height + EPSILON &&
          page.cursorY + keepHeight > contentBottom + EPSILON
        ) {
          flushPage();
        }
      }

      let lineCursor = 0;
      let isContinuation = false;

      while (lineCursor < measured.lines.length) {
        const before =
          page.items.length === 0 || isContinuation
            ? 0
            : gapBefore(block, page.previousBlock, spec);
        const targetY = page.cursorY + before;
        const availableHeight = contentBottom - targetY;
        let endLine = lastFittingLine(
          measured.lines,
          lineCursor,
          availableHeight,
        );

        if (endLine === undefined && page.items.length > 0) {
          flushPage();
          isContinuation = true;
          continue;
        }

        const forcedLine = endLine === undefined;
        endLine ??= lineCursor;
        const firstLine = measured.lines[lineCursor]!;
        const lastLine = measured.lines[endLine]!;
        const naturalHeight = lineSliceHeight(
          measured.lines,
          lineCursor,
          endLine,
        );
        const frameHeight = forcedLine
          ? Math.min(naturalHeight, contentRect.height)
          : naturalHeight;

        const item = {
          kind: "paragraph-slice",
          paragraphKey: measured.key,
          sectionId,
          blockId: block.id,
          source: {
            sectionId,
            blockId: block.id,
            startOffset: firstLine.startOffset,
            endOffset: lastLine.endOffset,
          },
          frame: {
            x: contentRect.x,
            y: targetY,
            width: contentRect.width,
            height: frameHeight,
          },
          sourceTop: firstLine.top,
          ...(block.noteKind ? { noteKind: block.noteKind } : {}),
        } as const;
        page.items.push(item);
        page.links.push(
          ...linkRegionsForSlice(item, measured, resolveRuns(block)),
        );
        page.cursorY = targetY + frameHeight;
        lineCursor = endLine + 1;

        if (lineCursor < measured.lines.length) {
          flushPage();
          isContinuation = true;
        } else {
          page.previousBlock = block;
        }
      }
      continue;
    }

    while (true) {
      const before =
        page.items.length === 0
          ? 0
          : gapBefore(block, page.previousBlock, spec);
      const frame = imageFrame(
        block,
        contentRect,
        spec.imageMaxHeightRatio,
        page.cursorY + before,
      );

      if (
        page.items.length > 0 &&
        frame.y + frame.height > contentBottom + EPSILON
      ) {
        flushPage();
        continue;
      }

      page.items.push({
        kind: "image",
        sectionId,
        blockId: block.id,
        source: {
          sectionId,
          blockId: block.id,
          startOffset: 0,
          endOffset: 1,
        },
        assetId: block.assetId,
        alt: block.alt,
        frame,
      });
      page.cursorY = frame.y + frame.height;
      page.previousBlock = block;
      break;
    }
  }

  flushPage();

  return {
    pages,
    paragraphs,
    locationIndex: createPageLocationIndex(pages),
  };
}

export function paginateBook<THandle>(
  book: BookIR,
  spec: PageLayoutSpec,
  backend: ParagraphLayoutBackend<THandle>,
): PaginationResult<THandle> {
  assertValidBookOnce(book);
  return paginateSections(book, book.sections, spec, backend);
}

export function paginateBookSection<THandle>(
  book: BookIR,
  sectionIndex: number,
  spec: PageLayoutSpec,
  backend: ParagraphLayoutBackend<THandle>,
): PaginationResult<THandle> {
  assertValidBookOnce(book);
  if (!Number.isInteger(sectionIndex) || !book.sections[sectionIndex]) {
    throw new RangeError("sectionIndex must identify an existing book section");
  }
  return paginateSections(book, [book.sections[sectionIndex]], spec, backend);
}
