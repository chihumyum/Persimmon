import type {
  MeasuredLine,
  ParagraphLayoutBackend,
  ParagraphLayoutInput,
  Rect,
  TypographyPreset,
} from "@persimmon/layout";
import {
  FontSlant,
  FontWeight,
  Skia,
  TextAlign,
  type SkParagraph,
  type SkParagraphStyle,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";

import { normalizeUtf16Boundary } from "./utf16";

const TEXT_COLOR = Skia.Color("#2f2b26");

function textAlignOf(align: TypographyPreset["align"]): TextAlign {
  switch (align) {
    case "center":
      return TextAlign.Center;
    case "justify":
      return TextAlign.Justify;
    default:
      return TextAlign.Start;
  }
}

function textStyleOf(
  input: ParagraphLayoutInput,
  marks: readonly ("strong" | "emphasis")[],
): SkTextStyle {
  return {
    color: TEXT_COLOR,
    fontFamilies: [...input.style.fontFamilies],
    fontSize: input.style.fontSize,
    fontStyle: {
      weight: (marks.includes("strong")
        ? FontWeight.Bold
        : (input.style.weight ?? FontWeight.Normal)) as FontWeight,
      slant:
        marks.includes("emphasis") || input.style.style === "italic"
          ? FontSlant.Italic
          : FontSlant.Upright,
    },
    heightMultiplier: input.style.heightMultiplier,
    locale: "zh-CN",
  };
}

function paragraphStyleOf(input: ParagraphLayoutInput): SkParagraphStyle {
  return {
    textAlign: textAlignOf(input.style.align),
    textStyle: textStyleOf(input, []),
  };
}

function lineGeometry(
  line: ReturnType<SkParagraph["getLineMetrics"]>[number],
): MeasuredLine {
  return {
    startOffset: line.startIndex,
    endOffset: line.endIncludingNewline,
    visibleEndOffset: line.endExcludingWhitespaces,
    top: line.baseline - line.ascent,
    bottom: line.baseline + line.descent,
    baseline: line.baseline,
  };
}

/**
 * Production ParagraphLayoutBackend for the shared paginator.
 *
 * RN Skia 2.6.2 normalizes public Paragraph indexes to UTF-16 on both
 * CanvasKit and native Skia. That is deliberately the same coordinate system
 * used by BookIR.
 */
export function createSkiaParagraphBackend(
  fontProvider: SkTypefaceFontProvider,
): ParagraphLayoutBackend<SkParagraph> {
  return {
    layout(input) {
      const builder = Skia.ParagraphBuilder.Make(
        paragraphStyleOf(input),
        fontProvider,
      );

      for (const run of input.runs) {
        builder.pushStyle(textStyleOf(input, run.marks));
        builder.addText(run.text);
        builder.pop();
      }

      const paragraph = builder.build();
      if (typeof builder.dispose === "function") {
        builder.dispose();
      }
      paragraph.layout(input.width);
      const lines = paragraph.getLineMetrics().map(lineGeometry);

      return {
        key: input.key,
        handle: paragraph,
        width: input.width,
        height: paragraph.getHeight(),
        lines,
        hitTest(x, y) {
          return normalizeUtf16Boundary(
            input.text,
            paragraph.getGlyphPositionAtCoordinate(x, y),
          );
        },
        rectsForRange(startOffset, endOffset): readonly Rect[] {
          const start = normalizeUtf16Boundary(
            input.text,
            startOffset,
            "backward",
          );
          const end = normalizeUtf16Boundary(input.text, endOffset, "forward");
          return paragraph
            .getRectsForRange(start, end)
            .map(({ x, y, width, height }) => ({
              x,
              y,
              width,
              height,
            }));
        },
      };
    },
  };
}
