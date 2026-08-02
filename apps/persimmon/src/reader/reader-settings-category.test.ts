import { describe, expect, it } from "vitest";

import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
} from "../library/types";
import {
  resetPageAppearance,
  resetTextAppearance,
} from "./reader-settings-category";

const customized: ReaderAppearanceSettings = {
  ...DEFAULT_READER_APPEARANCE,
  colorMode: "dark",
  theme: "cool",
  font: {
    ...DEFAULT_READER_APPEARANCE.font,
    selectedFontId: "custom-font",
  },
  fontSize: 27,
  horizontalMargin: 64,
  lineHeight: 1.9,
  paragraphSpacing: 1.4,
  progressDisplay: "both",
};

describe("reader settings categories", () => {
  it("resets page presentation without touching text layout", () => {
    expect(resetPageAppearance(customized)).toEqual({
      ...customized,
      colorMode: DEFAULT_READER_APPEARANCE.colorMode,
      progressDisplay: DEFAULT_READER_APPEARANCE.progressDisplay,
      theme: DEFAULT_READER_APPEARANCE.theme,
    });
  });

  it("resets text layout without touching page presentation", () => {
    expect(resetTextAppearance(customized)).toEqual({
      ...customized,
      font: DEFAULT_READER_APPEARANCE.font,
      fontSize: DEFAULT_READER_APPEARANCE.fontSize,
      horizontalMargin: DEFAULT_READER_APPEARANCE.horizontalMargin,
      lineHeight: DEFAULT_READER_APPEARANCE.lineHeight,
      paragraphSpacing: DEFAULT_READER_APPEARANCE.paragraphSpacing,
    });
  });
});
