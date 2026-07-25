import { describe, expect, it } from "vitest";

import {
  PAGE_CAPTURE_BYTE_BUDGET,
  PAGE_CAPTURE_CACHE_BYTE_BUDGET,
  PAGE_CAPTURE_MAX_SCALE,
  pageCaptureEntryBudget,
  pageCaptureScale,
} from "./page-capture-budget";

describe("transition page capture budget", () => {
  it("uses at most a 2x texture", () => {
    expect(pageCaptureScale(390, 844)).toBe(PAGE_CAPTURE_MAX_SCALE);
  });

  it("reduces scale to remain inside the byte budget", () => {
    const scale = pageCaptureScale(2400, 1800);
    expect(scale).not.toBeNull();
    expect(2400 * 1800 * 4 * scale! ** 2).toBeLessThanOrEqual(
      PAGE_CAPTURE_BYTE_BUDGET + 1,
    );
  });

  it("declines a capture when even 1x exceeds the budget", () => {
    expect(pageCaptureScale(5000, 5000)).toBeNull();
    expect(pageCaptureScale(0, 800)).toBeNull();
  });

  it("bounds the complete concurrent prewarm cache", () => {
    const maximumEntries = 18;
    expect(pageCaptureEntryBudget(maximumEntries) * maximumEntries).toBe(
      PAGE_CAPTURE_CACHE_BYTE_BUDGET,
    );
    expect(pageCaptureEntryBudget(1)).toBe(PAGE_CAPTURE_BYTE_BUDGET);
  });
});
