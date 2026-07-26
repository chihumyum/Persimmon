import { describe, expect, it } from "vitest";

import {
  createPageProgressDecoration,
  progressDisplayHasFooter,
  progressDisplayHasHeader,
  progressDisplayWithHeaderVisibility,
} from "./page-progress-decoration";

describe("page progress decoration", () => {
  it("derives labels from the physical page address instead of settled state", () => {
    expect(
      createPageProgressDecoration({
        address: { sectionIndex: 1, pageIndex: 2 },
        bookTitle: "整本书",
        sectionTitle: " 第二章 ",
        sectionCount: 4,
        pageCount: 10,
      }),
    ).toEqual({
      sectionTitle: "第二章",
      percentage: 33,
      percentageLabel: "33%",
      footerLabel: "3 / 10 · 33%",
    });
  });

  it("falls back to the book title and clamps invalid addresses", () => {
    expect(
      createPageProgressDecoration({
        address: { sectionIndex: 20, pageIndex: -2 },
        bookTitle: "整本书",
        sectionTitle: " ",
        sectionCount: 2,
        pageCount: 0,
      }),
    ).toEqual({
      sectionTitle: "整本书",
      percentage: 100,
      percentageLabel: "100%",
      footerLabel: "1 / 1 · 100%",
    });
  });

  it("temporarily suppresses only the header while reader controls are open", () => {
    expect(progressDisplayWithHeaderVisibility("header", false)).toBe("hidden");
    expect(progressDisplayWithHeaderVisibility("both", false)).toBe("footer");
    expect(progressDisplayWithHeaderVisibility("footer", false)).toBe("footer");
    expect(progressDisplayWithHeaderVisibility("both", true)).toBe("both");
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
