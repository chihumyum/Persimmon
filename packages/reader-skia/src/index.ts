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
export { READER_PAPER_COLOR } from "./reader-theme";
export {
  LiveReader,
  type LiveReaderProps,
  type ReaderLayoutMode,
  type ReaderProgress,
} from "./live-reader";
export { normalizeUtf16Boundary, type Utf16BoundaryAffinity } from "./utf16";
