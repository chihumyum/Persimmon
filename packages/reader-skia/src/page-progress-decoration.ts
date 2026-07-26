import type { ReaderProgressDisplay } from "./reader-appearance";
import type { PageAddress } from "./section-navigation";

export interface PageProgressDecoration {
  readonly sectionTitle: string;
  readonly percentage: number;
  readonly percentageLabel: string;
  readonly pageNumber: number;
  readonly pageCount: number;
  readonly pageLabel: string;
}

export type PageProgressPresentation = "reading" | "toolbar";

export interface PageProgressDecorationInput {
  readonly address: PageAddress;
  readonly bookTitle: string;
  readonly sectionTitle?: string;
  readonly sectionPageCounts: readonly number[];
  readonly currentSectionPageCount?: number;
  readonly pagesPerView?: number;
}

export function createPageProgressDecoration({
  address,
  bookTitle,
  sectionTitle,
  sectionPageCounts,
  currentSectionPageCount,
  pagesPerView = 1,
}: PageProgressDecorationInput): PageProgressDecoration {
  const normalizedPagesPerView = Math.max(1, Math.floor(pagesPerView));
  const normalizedPageCounts =
    sectionPageCounts.length > 0
      ? sectionPageCounts.map((count) => Math.max(1, Math.floor(count)))
      : [1];
  const sectionIndex = clampInteger(
    address.sectionIndex,
    0,
    normalizedPageCounts.length - 1,
  );
  if (currentSectionPageCount !== undefined) {
    normalizedPageCounts[sectionIndex] = Math.max(
      1,
      Math.floor(currentSectionPageCount),
    );
  }
  const pageIndex = clampInteger(
    address.pageIndex,
    0,
    normalizedPageCounts[sectionIndex]! - 1,
  );
  const physicalPageCount = normalizedPageCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const physicalPageNumber =
    normalizedPageCounts
      .slice(0, sectionIndex)
      .reduce((total, count) => total + count, 0) +
    pageIndex +
    1;
  const pageCount = Math.ceil(physicalPageCount / normalizedPagesPerView);
  const pageNumber = Math.ceil(physicalPageNumber / normalizedPagesPerView);
  const percentage = Math.round((pageNumber / pageCount) * 100);

  return {
    sectionTitle: sectionTitle?.trim() || bookTitle,
    percentage,
    percentageLabel: `${percentage}%`,
    pageNumber,
    pageCount,
    pageLabel: `${pageNumber}`,
  };
}

export function progressDisplayForToolbar(
  display: ReaderProgressDisplay,
  toolbarVisible: boolean,
): ReaderProgressDisplay {
  if (!toolbarVisible) {
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
