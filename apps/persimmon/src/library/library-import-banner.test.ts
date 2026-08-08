import { describe, expect, it } from "vitest";

import { importProgressFraction } from "./library-import-banner";

describe("importProgressFraction", () => {
  it("converts completed imports into a clamped determinate fraction", () => {
    expect(
      importProgressFraction({
        completedBooks: 3,
        failedBooks: 1,
        importedBooks: 2,
        totalBooks: 12,
      }),
    ).toBe(0.25);
    expect(
      importProgressFraction({
        completedBooks: 13,
        failedBooks: 0,
        importedBooks: 13,
        totalBooks: 12,
      }),
    ).toBe(1);
    expect(
      importProgressFraction({
        completedBooks: 0,
        failedBooks: 0,
        importedBooks: 0,
        totalBooks: 0,
      }),
    ).toBe(0);
  });
});
