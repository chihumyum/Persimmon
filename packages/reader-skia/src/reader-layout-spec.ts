import {
  createDefaultPageLayoutSpec,
  type PageLayoutSpec,
} from "@persimmon/layout";

import type { ReaderAppearance } from "./reader-appearance";

const DEFAULT_PAGE_PADDING = createDefaultPageLayoutSpec({
  width: 1,
  height: 1,
}).padding;
/** Space between a safe-area edge and the first or last line of text. */
const SAFE_AREA_TEXT_CLEARANCE = 34;
export interface ReaderPageVerticalPadding {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Where the text block starts and ends: the default page margin, pushed
 * further in when the safe area (status bar, Dynamic Island, home indicator)
 * would otherwise crowd it.
 */
export function readerPageVerticalPadding(
  topInset: number,
  bottomInset: number,
): ReaderPageVerticalPadding {
  return {
    top: Math.max(
      DEFAULT_PAGE_PADDING.top,
      topInset + SAFE_AREA_TEXT_CLEARANCE,
    ),
    bottom: Math.max(
      DEFAULT_PAGE_PADDING.bottom,
      bottomInset + SAFE_AREA_TEXT_CLEARANCE,
    ),
  };
}

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
  const verticalPadding = readerPageVerticalPadding(topInset, bottomInset);
  return {
    ...spec,
    padding: {
      top: verticalPadding.top,
      right: inlineMargin,
      bottom: verticalPadding.bottom,
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
