import {
  SAMPLE_BOOK,
  type BookIR,
  type ParagraphBlockIR,
} from "@persimmon/book-core";

const passages = [
  "院子里的柿子在深秋慢慢变红。风从屋檐下经过，叶子翻出浅色的背面，像书页被轻轻掀起。屋里的人没有催促故事，只让它按自己的速度往前走。",
  "真正舒服的阅读器不会抢走注意力。文字应该稳稳待在纸面上，触碰边缘时页面立刻响应，手指连续落下也不必等待上一段动画结束。",
  "排版不是把字符串塞进一个方框。行距、留白、标题与下一段的关系，共同决定眼睛是否愿意继续向下。好的工具会把这些细节变成一种安静。",
  "以后作者可以把 Drifting 里的项目编译成一本随时可读的书。编辑在章节旁留下批注，作者再回到原稿修订；位置锚定文字，而不是某次分页产生的页码。",
] as const;

const readingBlocks: ParagraphBlockIR[] = Array.from(
  { length: 64 },
  (_, index) => ({
    kind: "paragraph",
    id: `reading-paragraph-${index + 1}`,
    runs:
      index % 11 === 0
        ? [
            {
              text: `第 ${index + 1} 段。`,
              marks: ["strong"],
            },
            {
              text: passages[index % passages.length],
            },
          ]
        : [
            {
              text: passages[index % passages.length],
              ...(index % 7 === 0
                ? { marks: ["emphasis"] as const }
                : {}),
            },
          ],
    source: {
      scheme: "fixture",
      documentId: "reading",
      elementId: `reading-paragraph-${index + 1}`,
    },
  }),
);

export const DEMO_BOOK: BookIR = {
  ...SAMPLE_BOOK,
  revisionId: "persimmon-sample-v2",
  title: "柿子熟了",
  sections: [
    ...SAMPLE_BOOK.sections,
    {
      id: "reading",
      title: "一段安静的试读",
      blocks: [
        {
          kind: "heading",
          id: "reading-heading",
          level: 1,
          runs: [{ text: "一段安静的试读" }],
          source: {
            scheme: "fixture",
            documentId: "reading",
            elementId: "reading-heading",
          },
        },
        ...readingBlocks,
      ],
    },
  ],
};
