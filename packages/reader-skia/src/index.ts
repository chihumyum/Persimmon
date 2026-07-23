export const READER_RENDERER_VERSION = 1;

export { createSkiaParagraphBackend } from "./skia-paragraph-backend";
export {
  LiveReader,
  type LiveReaderProps,
  type ReaderProgress,
} from "./live-reader";
export {
  normalizeUtf16Boundary,
  type Utf16BoundaryAffinity,
} from "./utf16";
