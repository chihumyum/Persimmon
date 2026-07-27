import type { BookLocator } from "@persimmon/book-core";

import type { LibraryReadingProgress } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBookLocator(value: unknown): value is BookLocator {
  if (!isRecord(value) || !isRecord(value.position)) {
    return false;
  }
  return (
    typeof value.bookId === "string" &&
    value.bookId.length > 0 &&
    typeof value.revisionId === "string" &&
    value.revisionId.length > 0 &&
    typeof value.position.sectionId === "string" &&
    value.position.sectionId.length > 0 &&
    typeof value.position.blockId === "string" &&
    value.position.blockId.length > 0 &&
    Number.isSafeInteger(value.position.offset) &&
    (value.position.offset as number) >= 0 &&
    (value.affinity === undefined ||
      value.affinity === "forward" ||
      value.affinity === "backward")
  );
}

function approximatePublicationProgress(
  locator: BookLocator,
  sectionIds: readonly string[],
): number {
  if (sectionIds.length === 0) {
    return 0;
  }
  const sectionIndex = sectionIds.indexOf(locator.position.sectionId);
  return sectionIndex < 0 ? 0 : sectionIndex / sectionIds.length;
}

function boundedProgress(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
}

/**
 * Accepts both the original locator-only records and the richer V2 progress
 * snapshots. Keeping this migration at the repository boundary lets the UI
 * consume one stable summary shape on Web and Native.
 */
export function readingProgressFromStored(
  value: unknown,
  sectionIds: readonly string[],
): LibraryReadingProgress | undefined {
  if (isBookLocator(value)) {
    return {
      locator: value,
      publicationProgress: approximatePublicationProgress(value, sectionIds),
    };
  }
  if (!isRecord(value) || !isBookLocator(value.locator)) {
    return undefined;
  }
  const publicationProgress =
    boundedProgress(value.publicationProgress) ??
    approximatePublicationProgress(value.locator, sectionIds);
  return {
    locator: value.locator,
    publicationProgress,
    ...(typeof value.updatedAt === "string"
      ? { updatedAt: value.updatedAt }
      : {}),
  };
}
