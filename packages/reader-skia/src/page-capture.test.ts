import { describe, expect, it } from "vitest";

import {
  PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET,
  PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET,
  PAGE_CAPTURE_MAX_SCALE,
  pageCapturePixelSize,
} from "./page-capture-budget";

describe("transition page capture budget", () => {
  it("fits a 3x active phone page inside the normal cache target", () => {
    expect(
      pageCapturePixelSize(390, 844, PAGE_CAPTURE_MAX_SCALE)!.byteSize,
    ).toBeLessThan(PAGE_CAPTURE_CACHE_TARGET_BYTE_BUDGET);
  });

  it("leaves hard reserve for a large active 1x page", () => {
    expect(pageCapturePixelSize(5000, 5000, 1)!.byteSize).toBeLessThan(
      PAGE_CAPTURE_CACHE_HARD_BYTE_BUDGET,
    );
    expect(pageCapturePixelSize(0, 800, 1)).toBeNull();
  });

  it("accounts from rounded physical pixels rather than theoretical entries", () => {
    expect(pageCapturePixelSize(390.4, 843.6, 2.5)).toEqual({
      width: 976,
      height: 2109,
      byteSize: 976 * 2109 * 4,
    });
  });
});
