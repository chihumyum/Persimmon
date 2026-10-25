import type { ParagraphLayoutInput } from "@persimmon/layout";
import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTransientSkiaParagraphBackend } from "./skia-paragraph-backend";

const mocks = vi.hoisted(() => {
  const builders: Array<{
    addPlaceholder: ReturnType<typeof vi.fn>;
    addText: ReturnType<typeof vi.fn>;
  }> = [];
  const rangeRequests: Array<readonly [number, number]> = [];
  // Skia's text buffer as seen by the mocked paragraph: an indent placeholder
  // contributes one UTF-16 unit, exactly like U+FFFC in SkParagraph.
  let skiaTextLength = 0;
  const makeBuilder = () => {
    skiaTextLength = 0;
    const builder = {
      addPlaceholder: vi.fn(() => {
        skiaTextLength += 1;
        return builder;
      }),
      addText: vi.fn((text: string) => {
        skiaTextLength += text.length;
        return builder;
      }),
      build: vi.fn(() => {
        const length = skiaTextLength;
        const split = Math.floor(length / 2);
        return {
          dispose: vi.fn(),
          getGlyphPositionAtCoordinate: vi.fn((x: number) => Math.floor(x)),
          getHeight: vi.fn(() => 40),
          getLineMetrics: vi.fn(() => [
            {
              startIndex: 0,
              endIncludingNewline: split,
              endExcludingWhitespaces: split,
              baseline: 16,
              ascent: 16,
              descent: 4,
            },
            {
              startIndex: split,
              endIncludingNewline: length,
              endExcludingWhitespaces: length,
              baseline: 36,
              ascent: 16,
              descent: 4,
            },
          ]),
          getRectsForRange: vi.fn((start: number, end: number) => {
            rangeRequests.push([start, end]);
            return [{ x: start, y: 0, width: end - start, height: 20 }];
          }),
          layout: vi.fn(),
        };
      }),
      dispose: vi.fn(),
      pop: vi.fn(() => builder),
      pushStyle: vi.fn(() => builder),
    };
    builders.push(builder);
    return builder;
  };
  return { builders, makeBuilder, rangeRequests };
});

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@shopify/react-native-skia", () => ({
  FontSlant: { Italic: 1, Upright: 0 },
  FontWeight: { Bold: 700, Normal: 400 },
  PlaceholderAlignment: { Baseline: 0 },
  Skia: {
    Color: (color: string) => color,
    ParagraphBuilder: { Make: () => mocks.makeBuilder() },
  },
  TextAlign: { Center: 2, End: 5, Justify: 3, Start: 4 },
  TextBaseline: { Alphabetic: 0 },
  TextDecoration: { Underline: 1 },
}));

function paragraphInput(firstLineIndent?: number): ParagraphLayoutInput {
  const text = "一二三四五六七八";
  return {
    key: "paragraph",
    text,
    runs: [{ text, startOffset: 0, endOffset: text.length, marks: [] }],
    width: 200,
    style: {
      fontFamilies: ["Noto Serif SC"],
      fontSize: 20,
      heightMultiplier: 1.65,
      ...(firstLineIndent === undefined ? {} : { firstLineIndent }),
    },
  };
}

describe("Skia paragraph first-line indent", () => {
  beforeEach(() => {
    mocks.builders.length = 0;
    mocks.rangeRequests.length = 0;
  });

  it("adds no placeholder when the paragraph is not indented", () => {
    const backend = createTransientSkiaParagraphBackend(
      {} as SkTypefaceFontProvider,
    );

    const measured = backend.layout(paragraphInput());

    expect(mocks.builders[0]!.addPlaceholder).not.toHaveBeenCalled();
    expect(measured.lines.map((line) => line.startOffset)).toEqual([0, 4]);
    expect(measured.lines.at(-1)!.endOffset).toBe(8);
  });

  it("reserves the indent and keeps BookIR offsets exact", () => {
    const backend = createTransientSkiaParagraphBackend(
      {} as SkTypefaceFontProvider,
    );

    const measured = backend.layout(paragraphInput(40));

    expect(mocks.builders[0]!.addPlaceholder).toHaveBeenCalledWith(
      40,
      0,
      0,
      0,
      0,
    );
    // Skia reports lines over nine units (placeholder + eight characters).
    expect(
      measured.lines.map((line) => [line.startOffset, line.endOffset]),
    ).toEqual([
      [0, 3],
      [3, 8],
    ]);
    expect(measured.hitTest(0, 0)).toBe(0);
    expect(measured.hitTest(5, 0)).toBe(4);
    expect(measured.hitTest(99, 0)).toBe(8);

    measured.rectsForRange(2, 5);
    expect(mocks.rangeRequests).toEqual([[3, 6]]);
  });
});
