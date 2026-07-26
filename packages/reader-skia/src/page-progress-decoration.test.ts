import { describe, expect, it } from "vitest";

import {
  createPageProgressDecoration,
  progressDisplayHasFooter,
  progressDisplayHasHeader,
  progressDisplayForToolbar,
} from "./page-progress-decoration";

describe("page progress decoration", () => {
  it("derives a continuous publication page across section boundaries", () => {
    expect(
      createPageProgressDecoration({
        address: { sectionIndex: 1, pageIndex: 2 },
        bookTitle: "整本书",
        sectionTitle: " 第二章 ",
        sectionPageCounts: [2, 10, 3],
      }),
    ).toEqual({
      sectionTitle: "第二章",
      percentage: 33,
      percentageLabel: "33%",
      pageNumber: 5,
      pageCount: 15,
      pageLabel: "5 / 15",
    });
  });

  it("falls back to the book title and clamps invalid addresses", () => {
    expect(
      createPageProgressDecoration({
        address: { sectionIndex: 20, pageIndex: -2 },
        bookTitle: "整本书",
        sectionTitle: " ",
        sectionPageCounts: [],
      }),
    ).toEqual({
      sectionTitle: "整本书",
      percentage: 100,
      percentageLabel: "100%",
      pageNumber: 1,
      pageCount: 1,
      pageLabel: "1 / 1",
    });
  });

  it("moves the configured header into the toolbar while preserving the footer", () => {
    expect(progressDisplayForToolbar("header", true)).toBe("hidden");
    expect(progressDisplayForToolbar("both", true)).toBe("footer");
    expect(progressDisplayForToolbar("footer", true)).toBe("footer");
    expect(progressDisplayForToolbar("both", false)).toBe("both");
  });

  it("reports the visible decoration faces for every display mode", () => {
    expect(progressDisplayHasHeader("header")).toBe(true);
    expect(progressDisplayHasHeader("both")).toBe(true);
    expect(progressDisplayHasHeader("footer")).toBe(false);
    expect(progressDisplayHasFooter("footer")).toBe(true);
    expect(progressDisplayHasFooter("both")).toBe(true);
    expect(progressDisplayHasFooter("header")).toBe(false);
  });
});
