import { describe, expect, it } from "vitest";

import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
} from "../library/types";
import {
  READER_TYPOGRAPHY_CONTROLS,
  readerTypographyEquals,
  readerTypographyValues,
  resetReaderTypography,
  updateReaderTypography,
} from "./reader-typography-preview";

const changed: ReaderAppearanceSettings = {
  ...DEFAULT_READER_APPEARANCE,
  fontSize: 27,
  horizontalMargin: 64,
  lineHeight: 1.4,
  paragraphSpacing: 1.7,
};

describe("Reader typography preview model", () => {
  it("builds inclusive, step-aligned wheel values", () => {
    for (const control of READER_TYPOGRAPHY_CONTROLS) {
      const values = readerTypographyValues(control);
      expect(values[0]).toBe(control.minimum);
      expect(values.at(-1)).toBe(control.maximum);
    }
  });

  it("exposes the expanded large-screen adjustment ranges", () => {
    expect(READER_TYPOGRAPHY_CONTROLS).toEqual([
      { key: "fontSize", minimum: 12, maximum: 48, step: 1 },
      { key: "lineHeight", minimum: 1, maximum: 3, step: 0.05 },
      { key: "paragraphSpacing", minimum: 0, maximum: 4, step: 0.1 },
      { key: "horizontalMargin", minimum: 0, maximum: 320, step: 4 },
    ]);
  });

  it("updates only the selected typography value", () => {
    expect(updateReaderTypography(changed, "fontSize", 24)).toEqual({
      ...changed,
      fontSize: 24,
    });
  });

  it("resets numeric typography without replacing the selected font", () => {
    const custom = {
      ...changed,
      font: { ...changed.font, selectedFontId: "custom" },
    };
    const reset = resetReaderTypography(custom);
    expect(readerTypographyEquals(reset, DEFAULT_READER_APPEARANCE)).toBe(true);
    expect(reset.font.selectedFontId).toBe("custom");
  });
});
