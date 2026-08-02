import { BOOK_IR_VERSION, type BookIR } from "../model";

export const SAMPLE_BOOK: BookIR = {
  schemaVersion: BOOK_IR_VERSION,
  id: "test-book",
  revisionId: "test-book-v1",
  title: "Test Book",
  language: "en",
  assets: {
    "test-cover": {
      id: "test-cover",
      mediaType: "image/svg+xml",
    },
  },
  sections: [
    {
      id: "opening",
      title: "Opening",
      blocks: [
        {
          kind: "heading",
          id: "opening-heading",
          level: 1,
          runs: [{ text: "Opening" }],
          source: {
            scheme: "fixture",
            documentId: "opening",
            elementId: "opening-heading",
          },
        },
        {
          kind: "paragraph",
          id: "opening-paragraph",
          runs: [{ text: "A quiet reader keeps the story in focus." }],
          source: {
            scheme: "fixture",
            documentId: "opening",
            elementId: "opening-paragraph",
          },
        },
        {
          kind: "image",
          id: "opening-image",
          assetId: "test-cover",
          alt: "Test cover placeholder",
          intrinsicSize: { width: 1200, height: 900 },
          source: {
            scheme: "fixture",
            documentId: "opening",
            elementId: "opening-image",
          },
        },
      ],
    },
  ],
};
