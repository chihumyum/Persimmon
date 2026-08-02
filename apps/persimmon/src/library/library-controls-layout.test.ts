import { describe, expect, it } from "vitest";

import { shouldUseIconOnlySort } from "./library-controls-layout";

describe("library controls layout", () => {
  it("keeps the expanded sort control when filters and sort fit", () => {
    expect(
      shouldUseIconOnlySort({
        controlsWidth: 360,
        expandedSortWidth: 100,
        filterContentWidth: 248,
        gap: 12,
      }),
    ).toBe(false);
  });

  it("collapses sort to one icon when filter tabs need its text space", () => {
    expect(
      shouldUseIconOnlySort({
        controlsWidth: 359,
        expandedSortWidth: 100,
        filterContentWidth: 248,
        gap: 12,
      }),
    ).toBe(true);
  });

  it("waits for real layout measurements before collapsing", () => {
    expect(
      shouldUseIconOnlySort({
        controlsWidth: 0,
        expandedSortWidth: 100,
        filterContentWidth: 400,
        gap: 12,
      }),
    ).toBe(false);
  });
});
