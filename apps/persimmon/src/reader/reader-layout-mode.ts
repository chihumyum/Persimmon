import type { ReaderLayoutMode } from "@persimmon/reader-skia";

import type { ReaderLayoutPreference } from "../library/types";
import type { HorizontalInsets } from "./reader-chrome-layout";

/**
 * Narrowest physical page `auto` puts into a spread. At the default type
 * (20pt text, 32pt margins) a page this wide holds about 17 CJK characters
 * per line; the iPhone Duo inner display gives each page about 475pt.
 */
export const MINIMUM_AUTO_SPREAD_PAGE_WIDTH = 400;

export interface ReaderWindow {
  readonly width: number;
  readonly height: number;
  /** Stable horizontal safe-area insets of the reader. */
  readonly insets: HorizontalInsets;
}

/**
 * The layout the reader shows for a preference in the current window.
 *
 * A chosen single page or spread is always kept. `auto` picks a spread only
 * in a window wider than it is tall, where each page of the spread is at
 * least `MINIMUM_AUTO_SPREAD_PAGE_WIDTH` wide: in a tall window a spread's
 * gutter runs across a foldable's hinge and its pages are too narrow to read.
 * A spread mirrors the wider side inset onto both edges (see
 * `readerPageFrameInsets`), so that is the width it has to work with.
 */
export function effectiveReaderLayout(
  preference: ReaderLayoutPreference,
  { width, height, insets }: ReaderWindow,
): ReaderLayoutMode {
  if (preference !== "auto") {
    return preference;
  }
  if (width <= height) {
    return "single";
  }
  const spreadWidth = width - 2 * Math.max(insets.left, insets.right);
  return spreadWidth / 2 >= MINIMUM_AUTO_SPREAD_PAGE_WIDTH
    ? "spread"
    : "single";
}
