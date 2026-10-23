/** Shared by the Skia reading decoration and its React Native toolbar twin. */
import { readerPageVerticalPadding } from "./reader-layout-spec";

export const PAGE_DECORATION_FONT_SIZE = 12;
export const PAGE_DECORATION_HEIGHT_MULTIPLIER = 1.3;
export const PAGE_DECORATION_LETTER_SPACING = 0.2;
export const PAGE_DECORATION_LINE_HEIGHT =
  PAGE_DECORATION_FONT_SIZE * PAGE_DECORATION_HEIGHT_MULTIPLIER;
/**
 * Decoration text sits closer to the page edge than body text so the empty
 * margin beside a long chapter title does not read as space reserved for the
 * hidden toolbar buttons.
 */
export const PAGE_DECORATION_INLINE_MARGIN = 16;

/**
 * Top edge of the chapter title, centered in the band between the top safe
 * area and the first line of text so it neither hugs the screen edge on
 * displays without a top status bar nor crowds the text below the Dynamic
 * Island.
 */
export function pageDecorationHeaderY(
  topInset: number,
  bottomInset: number,
): number {
  const { top } = readerPageVerticalPadding(topInset, bottomInset);
  return topInset + (top - topInset - PAGE_DECORATION_LINE_HEIGHT) / 2;
}

/**
 * Top edge of the page number, centered in the band between the last line of
 * text and the bottom edge of the screen. The home indicator only reserves
 * room for gestures, so the passive page number may sit beside it.
 */
export function pageDecorationFooterY(
  height: number,
  topInset: number,
  bottomInset: number,
): number {
  const { bottom } = readerPageVerticalPadding(topInset, bottomInset);
  return height - (bottom + PAGE_DECORATION_LINE_HEIGHT) / 2;
}

/**
 * Inline margin of the header and footer text: the body margin, capped so
 * narrow pages keep room for text and never wider than
 * `PAGE_DECORATION_INLINE_MARGIN`.
 */
export function pageDecorationInlineMargin(
  inlineMargin: number,
  width: number,
  pagesPerView = 1,
): number {
  const pageWidth = width / Math.max(1, Math.floor(pagesPerView));
  const maximumInlineMargin = Math.max(8, (pageWidth - 96) / 2);
  return Math.min(
    inlineMargin,
    maximumInlineMargin,
    PAGE_DECORATION_INLINE_MARGIN,
  );
}
