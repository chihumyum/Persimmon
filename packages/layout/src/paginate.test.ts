import { BOOK_IR_VERSION, type BookIR } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import {
  paginateBook,
  type MeasuredParagraph,
  type PageLayoutSpec,
  type ParagraphLayoutBackend,
  type ParagraphLayoutInput,
} from "./index";

interface FixedHandle {
  key: string;
}

function createFixedBackend(
  charactersPerLine: number,
  lineHeight: number,
): ParagraphLayoutBackend<FixedHandle> {
  return {
    layout(input: ParagraphLayoutInput): MeasuredParagraph<FixedHandle> {
      const lines = [];
      let lineNumber = 0;
      for (
        let startOffset = 0;
        startOffset < input.text.length;
        startOffset += charactersPerLine
      ) {
        const endOffset = Math.min(
          input.text.length,
          startOffset + charactersPerLine,
        );
        lines.push({
          startOffset,
          endOffset,
          visibleEndOffset: endOffset,
          top: lineNumber * lineHeight,
          bottom: (lineNumber + 1) * lineHeight,
          baseline: (lineNumber + 0.8) * lineHeight,
        });
        lineNumber += 1;
      }

      return {
        key: input.key,
        handle: { key: input.key },
        width: input.width,
        height: lines.length * lineHeight,
        lines,
        hitTest: () => 0,
        rectsForRange: () => [],
      };
    },
  };
}

function createBook(text: string): BookIR {
  return {
    schemaVersion: BOOK_IR_VERSION,
    id: "pagination-test",
    revisionId: "v1",
    title: "分页测试",
    assets: {},
    sections: [
      {
        id: "chapter",
        blocks: [
          {
            kind: "paragraph",
            id: "long-paragraph",
            runs: [{ text }],
          },
        ],
      },
    ],
  };
}

const layoutSpec: PageLayoutSpec = {
  viewport: { width: 120, height: 60 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  body: {
    fontFamilies: ["Test"],
    fontSize: 20,
    heightMultiplier: 1,
  },
  headings: {
    1: {
      fontFamilies: ["Test"],
      fontSize: 30,
      heightMultiplier: 1,
    },
    2: {
      fontFamilies: ["Test"],
      fontSize: 26,
      heightMultiplier: 1,
    },
    3: {
      fontFamilies: ["Test"],
      fontSize: 22,
      heightMultiplier: 1,
    },
  },
  paragraphGap: 0,
  headingBefore: 0,
  headingAfter: 0,
  imageGap: 0,
  imageMaxHeightRatio: 1,
  minBodyLinesAfterHeading: 0,
};

describe("paginateBook", () => {
  it("slices a long Chinese paragraph into contiguous source ranges", () => {
    const result = paginateBook(
      createBook("柿".repeat(30)),
      layoutSpec,
      createFixedBackend(3, 20),
    );

    expect(result.pages).toHaveLength(4);

    const spans = result.pages.flatMap((page) =>
      page.items.map((item) => item.source),
    );
    expect(spans).toEqual([
      {
        sectionId: "chapter",
        blockId: "long-paragraph",
        startOffset: 0,
        endOffset: 9,
      },
      {
        sectionId: "chapter",
        blockId: "long-paragraph",
        startOffset: 9,
        endOffset: 18,
      },
      {
        sectionId: "chapter",
        blockId: "long-paragraph",
        startOffset: 18,
        endOffset: 27,
      },
      {
        sectionId: "chapter",
        blockId: "long-paragraph",
        startOffset: 27,
        endOffset: 30,
      },
    ]);

    expect(
      result.locationIndex.pageFor({
        sectionId: "chapter",
        blockId: "long-paragraph",
        offset: 9,
      }),
    ).toBe(1);
    expect(
      result.locationIndex.pageFor({
        sectionId: "chapter",
        blockId: "long-paragraph",
        offset: 30,
      }),
    ).toBe(3);
  });

  it("does not append an empty page when content fills the final page", () => {
    const result = paginateBook(
      createBook("柿".repeat(27)),
      layoutSpec,
      createFixedBackend(3, 20),
    );

    expect(result.pages).toHaveLength(3);
    expect(result.pages.every((page) => page.items.length > 0)).toBe(true);
    expect(result.pages.at(-1)?.end.offset).toBe(27);
  });

  it("honors normalized EPUB typography and block margins", () => {
    const inputs: ParagraphLayoutInput[] = [];
    const fixed = createFixedBackend(20, 20);
    const backend: ParagraphLayoutBackend<FixedHandle> = {
      layout(input) {
        inputs.push(input);
        return fixed.layout(input);
      },
    };
    const book: BookIR = {
      schemaVersion: BOOK_IR_VERSION,
      id: "styled-pagination-test",
      revisionId: "v1",
      title: "样式分页测试",
      assets: {},
      sections: [
        {
          id: "chapter",
          blocks: [
            {
              kind: "paragraph",
              id: "first",
              runs: [{ text: "First" }],
              style: {
                textAlign: "center",
                fontWeight: 700,
                fontStyle: "italic",
                marginBeforeEm: 1,
              },
            },
            {
              kind: "paragraph",
              id: "second",
              runs: [{ text: "Second" }],
              style: { marginBeforeEm: 2 },
            },
          ],
        },
      ],
    };

    const result = paginateBook(book, layoutSpec, backend);

    expect(inputs[0]!.style).toMatchObject({
      align: "center",
      weight: 700,
      style: "italic",
    });
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]!.items[0]!.frame.y).toBe(0);
    expect(result.pages[1]!.items[0]!.frame.y).toBe(0);
  });
});
