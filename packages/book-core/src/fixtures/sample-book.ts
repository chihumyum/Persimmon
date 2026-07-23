import { BOOK_IR_VERSION, type BookIR } from "../model";

export const SAMPLE_BOOK: BookIR = {
  schemaVersion: BOOK_IR_VERSION,
  id: "persimmon-sample",
  revisionId: "persimmon-sample-v1",
  title: "柿子",
  language: "zh-CN",
  assets: {
    "persimmon-cover": {
      id: "persimmon-cover",
      mediaType: "image/svg+xml",
    },
  },
  sections: [
    {
      id: "opening",
      title: "开始阅读",
      blocks: [
        {
          kind: "heading",
          id: "opening-heading",
          level: 1,
          runs: [{ text: "柿子熟了" }],
          source: {
            scheme: "fixture",
            documentId: "opening",
            elementId: "opening-heading",
          },
        },
        {
          kind: "paragraph",
          id: "opening-zh",
          runs: [
            {
              text: "院子里的柿子在深秋慢慢变红。风从屋檐下经过，叶子翻出浅色的背面，像书页被轻轻掀起。",
            },
          ],
          source: {
            scheme: "fixture",
            documentId: "opening",
            elementId: "opening-zh",
          },
        },
        {
          kind: "paragraph",
          id: "opening-en",
          runs: [
            {
              text: "A quiet reader should disappear until the story asks to be touched.",
            },
          ],
          source: {
            scheme: "fixture",
            documentId: "opening",
            elementId: "opening-en",
          },
        },
        {
          kind: "image",
          id: "opening-image",
          assetId: "persimmon-cover",
          alt: "一枚橙红色柿子的图片占位",
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
