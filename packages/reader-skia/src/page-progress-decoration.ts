import type { ReaderProgressDisplay } from "./reader-appearance";
import type { PageAddress } from "./section-navigation";

export interface PageProgressDecoration {
  readonly sectionTitle: string;
  readonly percentage: number;
  readonly percentageLabel: string;
  readonly footerLabel: string;
}

export interface PageProgressDecorationInput {
  readonly address: PageAddress;
  readonly bookTitle: string;
  readonly sectionTitle?: string;
  readonly sectionCount: number;
  readonly pageCount: number;
}

export function createPageProgressDecoration({
  address,
  bookTitle,
  sectionTitle,
  sectionCount,
  pageCount,
}: PageProgressDecorationInput): PageProgressDecoration {
  const normalizedSectionCount = Math.max(1, Math.floor(sectionCount));
  const normalizedPageCount = Math.max(1, Math.floor(pageCount));
  const sectionIndex = clampInteger(
    address.sectionIndex,
    0,
    normalizedSectionCount - 1,
  );
  const pageIndex = clampInteger(address.pageIndex, 0, normalizedPageCount - 1);
  const percentage = Math.round(
    ((sectionIndex + (pageIndex + 1) / normalizedPageCount) /
      normalizedSectionCount) *
      100,
  );

  return {
    sectionTitle: sectionTitle?.trim() || bookTitle,
    percentage,
    percentageLabel: `${percentage}%`,
    footerLabel: `${pageIndex + 1} / ${normalizedPageCount} · ${percentage}%`,
  };
}

export function progressDisplayWithHeaderVisibility(
  display: ReaderProgressDisplay,
  headerVisible: boolean,
): ReaderProgressDisplay {
  if (headerVisible) {
    return display;
  }
  switch (display) {
    case "header":
      return "hidden";
    case "both":
      return "footer";
    default:
      return display;
  }
}

export function progressDisplayHasHeader(
  display: ReaderProgressDisplay,
): boolean {
  return display === "header" || display === "both";
}

export function progressDisplayHasFooter(
  display: ReaderProgressDisplay,
): boolean {
  return display === "footer" || display === "both";
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
