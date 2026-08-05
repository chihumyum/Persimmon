import { describe, expect, it } from "vitest";

import { uiMotion, uiSheet, uiSize, uiSpace, uiTypography } from "./ui-tokens";

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

  it("uses one exact control rail across circular and segmented controls", () => {
    expect(uiSize.minimumHitTarget).toBeGreaterThanOrEqual(44);
    expect(
      uiSize.compactControl + uiSize.compactControlHitSlop * 2,
    ).toBeGreaterThanOrEqual(uiSize.minimumHitTarget);
    expect(
      uiSize.readerChrome + uiSize.readerChromeHitSlop * 2,
    ).toBeGreaterThanOrEqual(uiSize.minimumHitTarget);
    expect(uiSize.control).toBe(50);
    expect(uiSize.readerChrome).toBe(uiSize.control);
    expect(uiSize.segmentedControl).toBe(uiSize.control);
    expect(uiSize.sheetHeader).toBe(
      uiSize.control + uiSize.sheetHeaderInset * 2,
    );
    expect(uiSize.optionRow).toBe(60);
    expect(uiSize.optionRowWithDescription).toBe(76);
    expect(uiSize.nativeGroupedRowContent).toBe(44);
    expect(uiSize.nativeGroupedRowWithDescriptionContent).toBe(58);
  });

  it("uses one typography hierarchy for every settings surface", () => {
    expect(uiTypography.sheetHeader.fontSize).toBe(20);
    expect(uiTypography.segmentLabel.fontSize).toBe(17);
    expect(uiTypography.optionLabel.fontSize).toBe(17);
    expect(uiTypography.optionValue.fontSize).toBe(17);
    expect(uiTypography.optionAction.fontSize).toBe(17);
    expect(uiTypography.optionDescription.fontSize).toBe(14);
  });

  it("keeps the three Reader settings detents manually adjustable", () => {
    expect(uiSheet).toEqual({
      readerSettingsAllowsUserResizing: true,
      readerSettingsRootHeightRatio: 0.58,
      readerSettingsFontHeightRatio: 0.76,
      readerSettingsTypographyHeightRatio: 0.4,
    });
    expect(uiSheet.readerSettingsTypographyHeightRatio).toBeLessThan(
      uiSheet.readerSettingsRootHeightRatio,
    );
    expect(uiSheet.readerSettingsRootHeightRatio).toBeLessThan(
      uiSheet.readerSettingsFontHeightRatio,
    );
  });

  it("defines readable line heights and ordered motion durations", () => {
    for (const role of Object.values(uiTypography)) {
      expect(role.lineHeight).toBeGreaterThan(role.fontSize);
    }
    expect(uiMotion.fast).toBeLessThan(uiMotion.standard);
    expect(uiMotion.standard).toBeLessThan(uiMotion.deliberate);
  });
});
