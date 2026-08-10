import type {
  MeasuredLine,
  MeasuredParagraph,
  ParagraphLayoutBackend,
  ParagraphLayoutInput,
  Rect,
  ResolvedRun,
  TypographyPreset,
} from "@persimmon/layout";
import {
  FontSlant,
  FontWeight,
  Skia,
  TextDecoration,
  TextAlign,
  type SkParagraph,
  type SkParagraphStyle,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

import { normalizeUtf16Boundary } from "./utf16";
import { DEFAULT_READER_THEME, type ReaderTheme } from "./reader-theme";
import { afterSkiaPaint } from "./skia-lifecycle";
import { SkiaParagraphHandleCache } from "./skia-paragraph-handle-cache";
import { releaseRetiredSkiaResources } from "./skia-resource-release";

// A radius-ten spread stock graph covers at most 42 physical pages. Keeping
// 1,024 paragraphs leaves ample room for short one-line CJK blocks without
// retaining every paragraph in a multi-thousand-block EPUB spine document.
const MATERIALIZED_PARAGRAPH_LIMIT = 1024;

const retireMaterializedParagraph = new WeakMap<object, () => void>();

function textAlignOf(align: TypographyPreset["align"]): TextAlign {
  switch (align) {
    case "center":
      return TextAlign.Center;
    case "justify":
      return TextAlign.Justify;
    case "end":
      return TextAlign.End;
    default:
      return TextAlign.Start;
  }
}

function textStyleOf(
  input: ParagraphLayoutInput,
  theme: ReaderTheme,
  locale: string,
  run?: Pick<
    ResolvedRun,
    "bookFontFamilyId" | "link" | "marks" | "verticalAlign"
  >,
): SkTextStyle {
  const marks = run?.marks ?? [];
  const verticalScale = run?.verticalAlign ? 0.78 : 1;
  const linkColor = Skia.Color(theme.link);
  return {
    color: run?.link ? linkColor : Skia.Color(theme.text),
    ...(run?.link?.kind === "internal"
      ? {
          decoration: TextDecoration.Underline,
          decorationColor: linkColor,
        }
      : {}),
    fontFamilies: [
      ...(run?.bookFontFamilyId &&
      input.style.bookFontFamilyNames?.[run.bookFontFamilyId]
        ? [input.style.bookFontFamilyNames[run.bookFontFamilyId]]
        : []),
      ...input.style.fontFamilies,
    ],
    fontSize: input.style.fontSize * verticalScale,
    ...(run?.verticalAlign
      ? {
          fontFeatures: [
            {
              name: run.verticalAlign === "superscript" ? "sups" : "subs",
              value: 1,
            },
          ],
        }
      : {}),
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
    locale,
  };
}

function paragraphStyleOf(
  input: ParagraphLayoutInput,
  theme: ReaderTheme,
  locale: string,
): SkParagraphStyle {
  return {
    textAlign: textAlignOf(input.style.align),
    textStyle: textStyleOf(input, theme, locale),
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

function buildParagraph(
  input: ParagraphLayoutInput,
  fontProvider: SkTypefaceFontProvider,
  theme: ReaderTheme,
  locale: string,
): SkParagraph {
  const builder = Skia.ParagraphBuilder.Make(
    paragraphStyleOf(input, theme, locale),
    fontProvider,
  );
  try {
    for (const run of input.runs) {
      builder.pushStyle(textStyleOf(input, theme, locale, run));
      builder.addText(run.text);
      builder.pop();
    }
    return builder.build();
  } finally {
    builder.dispose?.();
  }
}

function layoutParagraph(
  input: ParagraphLayoutInput,
  fontProvider: SkTypefaceFontProvider,
  theme: ReaderTheme,
  locale: string,
): SkParagraph {
  const paragraph = buildParagraph(input, fontProvider, theme, locale);
  paragraph.layout(input.width);
  return paragraph;
}

function measuredParagraph(
  input: ParagraphLayoutInput,
  paragraph: SkParagraph,
): Omit<MeasuredParagraph<SkParagraph>, "handle"> {
  return {
    key: input.key,
    width: input.width,
    height: paragraph.getHeight(),
    lines: paragraph.getLineMetrics().map(lineGeometry),
    hitTest(x, y) {
      return normalizeUtf16Boundary(
        input.text,
        paragraph.getGlyphPositionAtCoordinate(x, y),
      );
    },
    rectsForRange(startOffset, endOffset): readonly Rect[] {
      const start = normalizeUtf16Boundary(input.text, startOffset, "backward");
      const end = normalizeUtf16Boundary(input.text, endOffset, "forward");
      return paragraph
        .getRectsForRange(start, end)
        .map(({ x, y, width, height }) => ({ x, y, width, height }));
    },
  };
}

/**
 * Retires a lazily materialized paragraph without touching its `handle`
 * getter. Returns false for conventional eager paragraph measurements.
 */
export function retireLazySkiaParagraph(
  paragraph: MeasuredParagraph<SkParagraph>,
): boolean {
  const retire = retireMaterializedParagraph.get(paragraph);
  if (!retire) {
    return false;
  }
  retire();
  return true;
}

/**
 * Production ParagraphLayoutBackend for the shared paginator.
 *
 * RN Skia 2.6.2 normalizes public native Paragraph indexes to UTF-16. That is
 * deliberately the same coordinate system used by BookIR.
 */
export function createSkiaParagraphBackend(
  fontProvider: SkTypefaceFontProvider,
  theme: ReaderTheme = DEFAULT_READER_THEME,
  locale = "und",
): ParagraphLayoutBackend<SkParagraph> {
  const handles = new SkiaParagraphHandleCache<SkParagraph>(
    MATERIALIZED_PARAGRAPH_LIMIT,
    (paragraph) => {
      afterSkiaPaint(() => releaseRetiredSkiaResources(Platform.OS, paragraph));
    },
  );
  let paragraphInstance = 0;

  return {
    layout(input) {
      // Two pagination generations can briefly contain the same paragraph
      // identity. Give each measured owner an independent cache slot so
      // retiring the old generation cannot dispose the new one's handle.
      const handleKey = `${++paragraphInstance}:${input.key}`;
      const measurement = layoutParagraph(input, fontProvider, theme, locale);
      const geometry = measuredParagraph(input, measurement);
      measurement.dispose();

      const materialized = (): SkParagraph =>
        handles.getOrCreate(handleKey, () =>
          layoutParagraph(input, fontProvider, theme, locale),
        );
      const measured: MeasuredParagraph<SkParagraph> = {
        ...geometry,
        get handle() {
          return materialized();
        },
        hitTest(x, y) {
          return normalizeUtf16Boundary(
            input.text,
            materialized().getGlyphPositionAtCoordinate(x, y),
          );
        },
        rectsForRange(startOffset, endOffset): readonly Rect[] {
          const start = normalizeUtf16Boundary(
            input.text,
            startOffset,
            "backward",
          );
          const end = normalizeUtf16Boundary(input.text, endOffset, "forward");
          return materialized()
            .getRectsForRange(start, end)
            .map(({ x, y, width, height }) => ({
              x,
              y,
              width,
              height,
            }));
        },
      };
      retireMaterializedParagraph.set(measured, () => {
        handles.release(handleKey);
      });
      return measured;
    },
  };
}

/**
 * Count-only pagination owns no display-list resources, so it can release
 * every eager paragraph immediately after the paginator consumes its metrics.
 */
export function createTransientSkiaParagraphBackend(
  fontProvider: SkTypefaceFontProvider,
  theme: ReaderTheme = DEFAULT_READER_THEME,
  locale = "und",
): ParagraphLayoutBackend<SkParagraph> {
  return {
    layout(input) {
      const paragraph = layoutParagraph(input, fontProvider, theme, locale);
      return {
        ...measuredParagraph(input, paragraph),
        handle: paragraph,
      };
    },
  };
}
