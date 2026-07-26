export const READER_RENDERER_VERSION = 1;

export {
  DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  normalizeAutomaticPageTurnTuning,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";
export {
  DEFAULT_GESTURE_PAGE_TURN_TUNING,
  normalizeGesturePageTurnTuning,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";
export { createSkiaParagraphBackend } from "./skia-paragraph-backend";
export {
  DEFAULT_READER_THEME,
  READER_PAPER_COLOR,
  resolveReaderTheme,
  type ReaderColorMode,
  type ReaderTheme,
  type ReaderThemeName,
  type ResolvedReaderColorScheme,
} from "./reader-theme";
export {
  DEFAULT_LIVE_READER_APPEARANCE,
  type ReaderAppearance,
  type ReaderProgressDisplay,
} from "./reader-appearance";
export {
  LiveReader,
  type LiveReaderProps,
  type ReaderLayoutMode,
  type ReaderPageTurnAnimation,
  type ReaderProgress,
  type ReaderSelectionMenuRequest,
} from "./live-reader";
export { normalizeUtf16Boundary, type Utf16BoundaryAffinity } from "./utf16";
