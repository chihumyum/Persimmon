import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
} from "../library/types";

export function resetPageAppearance(
  current: ReaderAppearanceSettings,
): ReaderAppearanceSettings {
  return {
    ...current,
    colorMode: DEFAULT_READER_APPEARANCE.colorMode,
    progressDisplay: DEFAULT_READER_APPEARANCE.progressDisplay,
    theme: DEFAULT_READER_APPEARANCE.theme,
  };
}

export function resetTextAppearance(
  current: ReaderAppearanceSettings,
): ReaderAppearanceSettings {
  return {
    ...current,
    font: DEFAULT_READER_APPEARANCE.font,
    fontSize: DEFAULT_READER_APPEARANCE.fontSize,
    horizontalMargin: DEFAULT_READER_APPEARANCE.horizontalMargin,
    lineHeight: DEFAULT_READER_APPEARANCE.lineHeight,
    paragraphSpacing: DEFAULT_READER_APPEARANCE.paragraphSpacing,
  };
}
