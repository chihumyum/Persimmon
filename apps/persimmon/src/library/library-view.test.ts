import type { BookLocator } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import type { LibraryBookSummary } from "./types";
import {
  readingProgressPercent,
  readingStatusForEntry,
  selectLibraryEntries,
} from "./library-view";

const LOCATOR: BookLocator = {
  bookId: "book-a",
  revisionId: "revision-a",
  position: { sectionId: "section-a", blockId: "block-a", offset: 0 },
};

function entry(
  id: string,
  overrides: Partial<LibraryBookSummary> = {},
): LibraryBookSummary {
  return {
    id,
    revisionId: `revision-${id}`,
    title: id,
    sourceName: `${id}.epub`,
    addedAt: "2026-01-01T00:00:00.000Z",
    originalByteLength: 1,
    status: "ready",
    warningCount: 0,
    ...overrides,
  };
}

describe("library view state", () => {
  it("derives unread, reading, and finished from persisted progress", () => {
    const unread = entry("unread");
    const reading = entry("reading", {
      locator: { ...LOCATOR, bookId: "reading" },
      readingProgress: 0.423,
    });
    const finished = entry("finished", {
      locator: { ...LOCATOR, bookId: "finished" },
      readingProgress: 0.999,
    });

    expect(readingStatusForEntry(unread)).toBe("unread");
    expect(readingStatusForEntry(reading)).toBe("reading");
    expect(readingStatusForEntry(finished)).toBe("finished");
    expect(readingProgressPercent(reading)).toBe(42);
    expect(readingProgressPercent(finished)).toBe(100);
  });

  it("filters by state and sorts read books before unread books by recency", () => {
    const entries = [
      entry("new-unread", { addedAt: "2026-07-27T10:00:00.000Z" }),
      entry("older-read", {
        locator: { ...LOCATOR, bookId: "older-read" },
        readingProgress: 0.2,
        lastReadAt: "2026-07-26T10:00:00.000Z",
      }),
      entry("latest-read", {
        locator: { ...LOCATOR, bookId: "latest-read" },
        readingProgress: 0.4,
        lastReadAt: "2026-07-27T09:00:00.000Z",
      }),
    ];

    expect(
      selectLibraryEntries(entries, "all", "recent").map(({ id }) => id),
    ).toEqual(["latest-read", "older-read", "new-unread"]);
    expect(
      selectLibraryEntries(entries, "reading", "recent").map(({ id }) => id),
    ).toEqual(["latest-read", "older-read"]);
  });

  it("supports import-time and title ordering", () => {
    const entries = [
      entry("book-b", {
        title: "B Book",
        addedAt: "2026-07-26T10:00:00.000Z",
      }),
      entry("book-a", {
        title: "A Book",
        addedAt: "2026-07-27T10:00:00.000Z",
      }),
    ];

    expect(
      selectLibraryEntries(entries, "all", "added").map(({ id }) => id),
    ).toEqual(["book-a", "book-b"]);
    expect(
      selectLibraryEntries(entries, "all", "title").map(({ id }) => id),
    ).toEqual(["book-a", "book-b"]);
  });
});
