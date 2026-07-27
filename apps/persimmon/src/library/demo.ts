import { DEMO_BOOK } from "../demo-book";
import {
  LIBRARY_SCHEMA_VERSION,
  type LibraryBookSummary,
  type LibraryReadingProgress,
  type OpenedLibraryBook,
  type StoredBookManifest,
} from "./types";

const DEMO_MANIFEST: StoredBookManifest = {
  schemaVersion: LIBRARY_SCHEMA_VERSION,
  compilerVersion: 0,
  id: DEMO_BOOK.id,
  revisionId: DEMO_BOOK.revisionId,
  title: DEMO_BOOK.title,
  ...(DEMO_BOOK.language ? { language: DEMO_BOOK.language } : {}),
  author: "Persimmon",
  sourceName: "内置试读",
  addedAt: "2026-07-23T00:00:00.000Z",
  assets: DEMO_BOOK.assets,
  sectionIds: DEMO_BOOK.sections.map((section) => section.id),
  metadata: {
    author: "Persimmon",
    pageProgressionDirection: "ltr",
  },
  warnings: [],
  status: "ready",
  originalByteLength: 0,
};

export function demoSummary(
  readingProgress?: LibraryReadingProgress,
): LibraryBookSummary {
  return {
    id: DEMO_BOOK.id,
    revisionId: DEMO_BOOK.revisionId,
    title: DEMO_BOOK.title,
    author: "Persimmon",
    sourceName: "内置试读",
    addedAt: "2026-07-23T00:00:00.000Z",
    originalByteLength: 0,
    builtIn: true,
    ...(readingProgress
      ? {
          locator: readingProgress.locator,
          readingProgress: readingProgress.publicationProgress,
          ...(readingProgress.updatedAt
            ? { lastReadAt: readingProgress.updatedAt }
            : {}),
        }
      : {}),
    status: "ready",
    warningCount: 0,
  };
}

export function openDemoBook(): OpenedLibraryBook {
  return {
    book: DEMO_BOOK,
    source: {
      manifest: DEMO_MANIFEST,
      async getSection(sectionId) {
        return DEMO_BOOK.sections.find((section) => section.id === sectionId);
      },
      async getResource() {
        return undefined;
      },
      async getOriginalEpub() {
        return undefined;
      },
    },
  };
}
