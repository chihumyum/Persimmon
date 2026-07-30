import { describe, expect, it } from "vitest";

import { uiMotion, uiSize, uiSpace, uiTypography } from "./ui-tokens";

describe("application design tokens", () => {
  it("keeps the spacing scale ordered and based on whole pixels", () => {
    const scale = [
      uiSpace.hairline,
      uiSpace.xxs,
      uiSpace.xs,
      uiSpace.sm,
      uiSpace.md,
      uiSpace.lg,
      uiSpace.xl,
      uiSpace.xxl,
      uiSpace.xxxl,
    ];

    expect(scale.every(Number.isInteger)).toBe(true);
    expect(scale).toEqual([...scale].sort((left, right) => left - right));
    expect(new Set(scale).size).toBe(scale.length);
  });

  it("keeps controls accessible without making reader chrome visually heavy", () => {
    expect(uiSize.minimumHitTarget).toBeGreaterThanOrEqual(44);
    expect(
      uiSize.compactControl + uiSize.compactControlHitSlop * 2,
    ).toBeGreaterThanOrEqual(uiSize.minimumHitTarget);
    expect(
      uiSize.readerChrome + uiSize.readerChromeHitSlop * 2,
    ).toBeGreaterThanOrEqual(uiSize.minimumHitTarget);
  });

  it("defines readable line heights and ordered motion durations", () => {
    for (const role of Object.values(uiTypography)) {
      expect(role.lineHeight).toBeGreaterThan(role.fontSize);
    }
    expect(uiMotion.fast).toBeLessThan(uiMotion.standard);
    expect(uiMotion.standard).toBeLessThan(uiMotion.deliberate);
  });
});
