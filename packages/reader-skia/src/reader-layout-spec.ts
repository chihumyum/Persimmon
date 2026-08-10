import {
  createDefaultPageLayoutSpec,
  type PageLayoutSpec,
} from "@persimmon/layout";

import type { ReaderAppearance } from "./reader-appearance";

export function createReaderLayoutSpec(
  width: number,
  height: number,
  appearance: ReaderAppearance,
  topInset = 0,
  bottomInset = 0,
): PageLayoutSpec {
  const spec = createDefaultPageLayoutSpec({ width, height });
  const scale = appearance.fontSize / spec.body.fontSize;
  const maximumInlineMargin = Math.max(8, (width - 96) / 2);
  const inlineMargin = Math.min(appearance.inlineMargin, maximumInlineMargin);
  const fontFamilies = [
    ...new Set([appearance.fontFamily, "Noto Serif SC", "Noto Sans Math"]),
  ];
  const bookFontFamilyNames = appearance.bookFontFamilyNames;
  return {
    ...spec,
    padding: {
      top: Math.max(spec.padding.top, topInset + 34),
      right: inlineMargin,
      bottom: Math.max(spec.padding.bottom, bottomInset + 34),
      left: inlineMargin,
    },
    body: {
      ...spec.body,
      fontFamilies,
      ...(bookFontFamilyNames ? { bookFontFamilyNames } : {}),
      fontSize: appearance.fontSize,
      heightMultiplier: appearance.lineHeight,
    },
    note: {
      ...spec.note,
      fontFamilies,
      ...(bookFontFamilyNames ? { bookFontFamilyNames } : {}),
      fontSize: spec.note.fontSize * scale,
    },
    headings: {
      1: {
        ...spec.headings[1],
        fontFamilies,
        ...(bookFontFamilyNames ? { bookFontFamilyNames } : {}),
        fontSize: spec.headings[1].fontSize * scale,
      },
      2: {
        ...spec.headings[2],
        fontFamilies,
        ...(bookFontFamilyNames ? { bookFontFamilyNames } : {}),
        fontSize: spec.headings[2].fontSize * scale,
      },
      3: {
        ...spec.headings[3],
        fontFamilies,
        ...(bookFontFamilyNames ? { bookFontFamilyNames } : {}),
        fontSize: spec.headings[3].fontSize * scale,
      },
    },
    paragraphGap: appearance.fontSize * appearance.paragraphSpacing,
    paragraphGapMode: "reader",
    ...(appearance.textAlignment === "book"
      ? {}
      : { bodyAlignmentOverride: appearance.textAlignment }),
  };
}
