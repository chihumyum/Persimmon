export const READER_RENDERER_VERSION = 1;

export {
  AUTOMATIC_PAGE_TURN_MAXIMUM_RELEASE_X,
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
  DEFAULT_READER_UI_MESSAGES,
  LiveReader,
  type LiveReaderProps,
  type ReaderLayoutMode,
  type ReaderPageTurnAnimation,
  type ReaderProgress,
  type ReaderSelectionMenuRequest,
  type ReaderUiMessages,
} from "./live-reader";
export { normalizeUtf16Boundary, type Utf16BoundaryAffinity } from "./utf16";
