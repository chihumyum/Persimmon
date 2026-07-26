import type { BookLocator } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import { mergeDeviceDocuments } from "./merge";
import {
  SYNC_SCHEMA_VERSION,
  type DeviceSyncDocument,
  type HybridClock,
} from "./types";

const locator: BookLocator = {
  bookId: "epub:book",
  revisionId: "epub-revision:book",
  position: { sectionId: "s1", blockId: "b1", offset: 12 },
};

function clock(wallTime: number, deviceId: string, counter = 0): HybridClock {
  return { wallTime, counter, deviceId };
}

describe("device state merge", () => {
  it("lets a newer tombstone delete an older book upsert", () => {
    const documents: DeviceSyncDocument[] = [
      {
        schemaVersion: SYNC_SCHEMA_VERSION,
        deviceId: "a",
        generation: 1,
        books: {
          [locator.bookId]: {
            kind: "upsert",
            clock: clock(100, "a"),
            bookId: locator.bookId,
            revisionId: locator.revisionId,
            fileName: "book.epub",
            title: "Book",
            addedAt: "2026-01-01T00:00:00.000Z",
            byteLength: 3,
          },
        },
        progress: {},
      },
      {
        schemaVersion: SYNC_SCHEMA_VERSION,
        deviceId: "b",
        generation: 1,
        books: {
          [locator.bookId]: {
            kind: "delete",
            clock: clock(200, "b"),
            bookId: locator.bookId,
          },
        },
        progress: {},
      },
    ];

    expect(mergeDeviceDocuments(documents).books[locator.bookId]?.kind).toBe(
      "delete",
    );
  });

  it("uses the newest independent progress event", () => {
    const documents: DeviceSyncDocument[] = [
      {
        schemaVersion: SYNC_SCHEMA_VERSION,
        deviceId: "a",
        generation: 1,
        books: {},
        progress: {
          [locator.bookId]: {
            clock: clock(100, "a"),
            locator,
          },
        },
      },
      {
        schemaVersion: SYNC_SCHEMA_VERSION,
        deviceId: "b",
        generation: 1,
        books: {},
        progress: {
          [locator.bookId]: {
            clock: clock(101, "b"),
            locator: {
              ...locator,
              position: { ...locator.position, offset: 30 },
            },
          },
        },
      },
    ];

    expect(
      mergeDeviceDocuments(documents).progress[locator.bookId]?.locator.position
        .offset,
    ).toBe(30);
  });
});
