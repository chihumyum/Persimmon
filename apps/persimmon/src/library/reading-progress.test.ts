import type { BookLocator } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import { readingProgressFromStored, sameBookLocator } from "./reading-progress";

const LOCATOR: BookLocator = {
  bookId: "book",
  revisionId: "revision",
  position: { sectionId: "section-b", blockId: "block", offset: 0 },
};
const SECTION_IDS = ["section-a", "section-b", "section-c", "section-d"];

describe("persisted reading progress", () => {
  it("migrates a legacy locator-only record with an approximate percentage", () => {
    expect(readingProgressFromStored(LOCATOR, SECTION_IDS)).toEqual({
      locator: LOCATOR,
      publicationProgress: 0.25,
    });
  });

  it("preserves new snapshots and bounds their display percentage", () => {
    expect(
      readingProgressFromStored(
        {
          locator: LOCATOR,
          publicationProgress: 1.4,
          updatedAt: "2026-07-27T10:00:00.000Z",
        },
        SECTION_IDS,
      ),
    ).toEqual({
      locator: LOCATOR,
      publicationProgress: 1,
      updatedAt: "2026-07-27T10:00:00.000Z",
    });
  });

  it("ignores corrupt progress without affecting book content", () => {
    expect(
      readingProgressFromStored(
        {
          locator: {
            ...LOCATOR,
            position: { ...LOCATOR.position, offset: -1 },
          },
        },
        SECTION_IDS,
      ),
    ).toBeUndefined();
  });

  it("compares every stable locator field", () => {
    expect(sameBookLocator(LOCATOR, { ...LOCATOR })).toBe(true);
    expect(
      sameBookLocator(LOCATOR, {
        ...LOCATOR,
        position: { ...LOCATOR.position, offset: 1 },
      }),
    ).toBe(false);
    expect(sameBookLocator(LOCATOR, { ...LOCATOR, affinity: "forward" })).toBe(
      false,
    );
  });
});
