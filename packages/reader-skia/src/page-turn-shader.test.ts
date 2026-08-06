import { describe, expect, it } from "vitest";

import { NATURAL_PAGE_SHADOW_SHADER } from "./page-turn-shader";

describe("natural Skia page shader", () => {
  it("removes the fixed spine shadow when no turn shadow is active", () => {
    expect(NATURAL_PAGE_SHADOW_SHADER).toContain("shadow.z * 0.32");
    expect(NATURAL_PAGE_SHADOW_SHADER).toContain("bookX * shadow.w");
  });
});
