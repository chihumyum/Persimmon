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
  const maximumHorizontalMargin = Math.max(8, (width - 96) / 2);
  const horizontalMargin = Math.min(
    appearance.horizontalMargin,
    maximumHorizontalMargin,
  );
  const fontFamilies = [appearance.fontFamily, "Noto Sans Math"];
  return {
    ...spec,
    padding: {
      top: Math.max(spec.padding.top, topInset + 34),
      right: horizontalMargin,
      bottom: Math.max(spec.padding.bottom, bottomInset + 34),
      left: horizontalMargin,
    },
    body: {
      ...spec.body,
      fontFamilies,
      fontSize: appearance.fontSize,
      heightMultiplier: appearance.lineHeight,
    },
    note: {
      ...spec.note,
      fontFamilies,
      fontSize: spec.note.fontSize * scale,
    },
    headings: {
      1: {
        ...spec.headings[1],
        fontFamilies,
        fontSize: spec.headings[1].fontSize * scale,
      },
      2: {
        ...spec.headings[2],
        fontFamilies,
        fontSize: spec.headings[2].fontSize * scale,
      },
      3: {
        ...spec.headings[3],
        fontFamilies,
        fontSize: spec.headings[3].fontSize * scale,
      },
    },
    paragraphGap: appearance.fontSize * appearance.paragraphSpacing,
    paragraphGapMode: "reader",
  };
}
