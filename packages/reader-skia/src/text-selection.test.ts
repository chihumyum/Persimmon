import type { BookIR } from "@persimmon/book-core";
import type {
  MeasuredParagraph,
  PageScene,
  PaginationResult,
} from "@persimmon/layout";
import { describe, expect, it } from "vitest";

import {
  compareTextPositions,
  createTextSelectionDocument,
  hitTestVisibleText,
  normalizeTextSelection,
  selectedText,
  textSelectionGeometry,
  wordRangeAt,
  wordSelectionAt,
} from "./text-selection";

const book: BookIR = {
  schemaVersion: 1,
  id: "book",
  revisionId: "revision",
  title: "Selection",
  language: "en",
  assets: {},
  sections: [
    {
      id: "section-1",
      blocks: [
        {
          kind: "paragraph",
          id: "block-1",
          runs: [{ text: "Read Apple Books." }],
        },
        {
          kind: "paragraph",
          id: "block-2",
          runs: [{ text: "Drag the handles." }],
        },
      ],
    },
  ],
};

const document = createTextSelectionDocument(book);

describe("text selection document", () => {
  it("orders positions and normalizes crossed handles", () => {
    const selection = {
      anchor: { sectionId: "section-1", blockId: "block-2", offset: 4 },
      focus: { sectionId: "section-1", blockId: "block-1", offset: 5 },
    };

    expect(
      compareTextPositions(document, selection.anchor, selection.focus),
    ).toBeGreaterThan(0);
    expect(normalizeTextSelection(document, selection)).toEqual({
      start: selection.focus,
      end: selection.anchor,
    });
  });

  it("copies a stable UTF-16 range across blocks", () => {
    expect(
      selectedText(document, {
        anchor: { sectionId: "section-1", blockId: "block-1", offset: 5 },
        focus: { sectionId: "section-1", blockId: "block-2", offset: 8 },
      }),
    ).toBe("Apple Books.\n\nDrag the");
  });
});

describe("word selection", () => {
  it("selects the word under an English long press", () => {
    expect(wordRangeAt("Read Apple Books.", 7, "en")).toEqual([5, 10]);
    expect(
      wordSelectionAt(
        document,
        { sectionId: "section-1", blockId: "block-1", offset: 7 },
        "en",
      ),
    ).toEqual({
      anchor: { sectionId: "section-1", blockId: "block-1", offset: 5 },
      focus: { sectionId: "section-1", blockId: "block-1", offset: 10 },
    });
  });

  it("keeps CJK and surrogate-pair boundaries intact", () => {
    const chinese = "长按文本选择";
    const [start, end] = wordRangeAt(chinese, 3, "zh-CN")!;
    expect(chinese.slice(start, end).trim()).not.toBe("");

    const emojiRange = wordRangeAt("A🍊B", 1, "en")!;
    expect(emojiRange[0]).not.toBe(2);
    expect(emojiRange[1]).not.toBe(2);
  });
});

describe("visible text geometry", () => {
  const paragraph: MeasuredParagraph<null> = {
    key: "paragraph",
    handle: null,
    width: 200,
    height: 40,
    lines: [
      {
        startOffset: 0,
        endOffset: 17,
        visibleEndOffset: 17,
        top: 0,
        bottom: 20,
        baseline: 15,
      },
    ],
    hitTest(x) {
      return Math.max(0, Math.min(17, Math.round(x / 10)));
    },
    rectsForRange(startOffset, endOffset) {
      return [
        {
          x: startOffset * 10,
          y: 0,
          width: (endOffset - startOffset) * 10,
          height: 20,
        },
      ];
    },
  };
  const page: PageScene = {
    index: 0,
    size: { width: 300, height: 400 },
    contentRect: { x: 20, y: 30, width: 260, height: 340 },
    items: [
      {
        kind: "paragraph-slice",
        paragraphKey: paragraph.key,
        sectionId: "section-1",
        blockId: "block-1",
        source: {
          sectionId: "section-1",
          blockId: "block-1",
          startOffset: 0,
          endOffset: 17,
        },
        frame: { x: 20, y: 30, width: 200, height: 20 },
        sourceTop: 0,
      },
    ],
    start: { sectionId: "section-1", blockId: "block-1", offset: 0 },
    end: { sectionId: "section-1", blockId: "block-1", offset: 17 },
  };
  const pagination: PaginationResult<null> = {
    pages: [page],
    paragraphs: new Map([[paragraph.key, paragraph]]),
    locationIndex: {
      pageFor: () => 0,
      positionAtPageStart: () => page.start,
    },
  };
  const visible = [{ page, pagination, offsetX: 300 }];

  it("maps spread coordinates into paragraph UTF-16 offsets", () => {
    expect(hitTestVisibleText(visible, 370, 40)).toEqual({
      sectionId: "section-1",
      blockId: "block-1",
      offset: 5,
    });
    expect(hitTestVisibleText(visible, 10, 10)).toBeUndefined();
  });

  it("translates SkParagraph range rectangles into reader coordinates", () => {
    const geometry = textSelectionGeometry(
      document,
      {
        anchor: { sectionId: "section-1", blockId: "block-1", offset: 5 },
        focus: { sectionId: "section-1", blockId: "block-1", offset: 10 },
      },
      visible,
    );

    expect(geometry).toEqual({
      rects: [
        {
          x: 370,
          y: 30,
          width: 50,
          height: 20,
          sectionId: "section-1",
          blockId: "block-1",
          startOffset: 5,
          endOffset: 10,
        },
      ],
      bounds: { x: 370, y: 30, width: 50, height: 20 },
      startHandle: { x: 370, top: 30, bottom: 50 },
      endHandle: { x: 420, top: 30, bottom: 50 },
    });
  });
});
