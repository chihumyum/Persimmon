import type { LibraryBookSummary } from "./types";

export type LibraryReadingStatus = "unread" | "reading" | "finished";

export type LibraryFilter = "all" | LibraryReadingStatus;

export type LibrarySort = "recent" | "added" | "title";

export interface LibraryGridEntry {
  readonly entry: LibraryBookSummary;
  readonly visible: boolean;
}

const FINISHED_THRESHOLD = 0.995;

function normalizedSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function searchLibraryEntries(
  entries: readonly LibraryBookSummary[],
  query: string,
): LibraryBookSummary[] {
  const normalizedQuery = normalizedSearchText(query);
  if (!normalizedQuery) {
    return [...entries];
  }
  return entries.filter(
    (entry) =>
      normalizedSearchText(entry.title).includes(normalizedQuery) ||
      normalizedSearchText(entry.author ?? "").includes(normalizedQuery),
  );
}

export function readingStatusForEntry(
  entry: LibraryBookSummary,
): LibraryReadingStatus {
  if (!entry.locator) {
    return "unread";
  }
  return (entry.readingProgress ?? 0) >= FINISHED_THRESHOLD
    ? "finished"
    : "reading";
}

export function isNewLibraryEntry(entry: LibraryBookSummary): boolean {
  return entry.status === "ready" && !entry.locator;
}

export function readingProgressPercent(entry: LibraryBookSummary): number {
  if (!entry.locator) {
    return 0;
  }
  const progress = Math.min(1, Math.max(0, entry.readingProgress ?? 0));
  return progress >= FINISHED_THRESHOLD ? 100 : Math.round(progress * 100);
}

function compareTitle(
  left: LibraryBookSummary,
  right: LibraryBookSummary,
): number {
  return left.title.localeCompare(right.title, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareDescendingIso(left?: string, right?: string): number {
  return (right ?? "").localeCompare(left ?? "");
}

export function selectLibraryEntries(
  entries: readonly LibraryBookSummary[],
  filter: LibraryFilter,
  sort: LibrarySort,
): LibraryBookSummary[] {
  const selected =
    filter === "all"
      ? [...entries]
      : entries.filter((entry) => readingStatusForEntry(entry) === filter);

  return selected.sort((left, right) => {
    if (sort === "title") {
      return compareTitle(left, right);
    }
    if (sort === "added") {
      return (
        compareDescendingIso(left.addedAt, right.addedAt) ||
        compareTitle(left, right)
      );
    }
    if (left.lastReadAt && !right.lastReadAt) {
      return -1;
    }
    if (!left.lastReadAt && right.lastReadAt) {
      return 1;
    }
    return (
      compareDescendingIso(left.lastReadAt, right.lastReadAt) ||
      compareDescendingIso(left.addedAt, right.addedAt) ||
      compareTitle(left, right)
    );
  });
}

export function arrangeLibraryGridEntries(
  entries: readonly LibraryBookSummary[],
  filter: LibraryFilter,
  sort: LibrarySort,
): LibraryGridEntry[] {
  return selectLibraryEntries(entries, "all", sort).map((entry) => ({
    entry,
    visible: filter === "all" || readingStatusForEntry(entry) === filter,
  }));
}
