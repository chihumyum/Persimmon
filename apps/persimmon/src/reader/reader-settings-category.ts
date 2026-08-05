import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
} from "../library/types";

export function resetReadingAppearance(
  current: ReaderAppearanceSettings,
): ReaderAppearanceSettings {
  return {
    ...current,
    colorMode: DEFAULT_READER_APPEARANCE.colorMode,
    progressDisplay: DEFAULT_READER_APPEARANCE.progressDisplay,
    theme: DEFAULT_READER_APPEARANCE.theme,
  };
}
