import {
  SAMPLE_BOOK,
  type BookIR,
  type ParagraphBlockIR,
} from "@persimmon/book-core";

const NOTE_REFERENCE_BLOCK_ID = "opening-note-references";
const FOOTNOTE_WITH_BACKLINK_ID = "note-footnote-with-backlink";
const FOOTNOTE_WITHOUT_BACKLINK_ID = "note-footnote-without-backlink";
const ENDNOTE_WITH_BACKLINK_ID = "note-endnote-with-backlink";

const firstReferenceLead = "脚注测试：第一条带有原书返回链接";
const secondReferenceLead = "，第二条故意不提供反向链接";
const endnoteReferenceLead = "，最后是一条跨章节尾注";
const firstReferenceOffset = firstReferenceLead.length;
const secondReferenceOffset =
  firstReferenceOffset + 1 + secondReferenceLead.length;
const endnoteReferenceOffset =
  secondReferenceOffset + 1 + endnoteReferenceLead.length;

const noteReferenceBlock: ParagraphBlockIR = {
  kind: "paragraph",
  id: NOTE_REFERENCE_BLOCK_ID,
  runs: [
    { text: firstReferenceLead },
    {
      text: "1",
      verticalAlign: "superscript",
      link: {
        kind: "note-reference",
        target: {
          sectionId: "notes",
          blockId: FOOTNOTE_WITH_BACKLINK_ID,
          offset: 0,
        },
        noteKind: "footnote",
        label: "1",
      },
    },
    { text: secondReferenceLead },
    {
      text: "2",
      verticalAlign: "superscript",
      link: {
        kind: "note-reference",
        target: {
          sectionId: "notes",
          blockId: FOOTNOTE_WITHOUT_BACKLINK_ID,
          offset: 0,
        },
        noteKind: "footnote",
        label: "2",
      },
    },
    { text: endnoteReferenceLead },
    {
      text: "3",
      verticalAlign: "superscript",
      link: {
        kind: "note-reference",
        target: {
          sectionId: "notes",
          blockId: ENDNOTE_WITH_BACKLINK_ID,
          offset: 0,
        },
        noteKind: "endnote",
        label: "3",
      },
    },
    { text: "。" },
  ],
  source: {
    scheme: "fixture",
    documentId: "opening",
    elementId: NOTE_REFERENCE_BLOCK_ID,
  },
};

const noteBlocks: ParagraphBlockIR[] = [
  {
    kind: "paragraph",
    id: FOOTNOTE_WITH_BACKLINK_ID,
    noteKind: "footnote",
    runs: [
      { text: "1　这条脚注保留了 EPUB 作者提供的反向链接。 " },
      {
        text: "↩ 返回",
        link: {
          kind: "note-backlink",
          target: {
            sectionId: "opening",
            blockId: NOTE_REFERENCE_BLOCK_ID,
            offset: firstReferenceOffset,
          },
          noteKind: "footnote",
          label: "1",
        },
      },
    ],
    source: {
      scheme: "fixture",
      documentId: "notes",
      elementId: FOOTNOTE_WITH_BACKLINK_ID,
    },
  },
  {
    kind: "paragraph",
    id: FOOTNOTE_WITHOUT_BACKLINK_ID,
    noteKind: "footnote",
    runs: [
      {
        text: "2　这条脚注故意没有反向链接，用来验证阅读器自己的“返回正文”兜底。",
      },
    ],
    source: {
      scheme: "fixture",
      documentId: "notes",
      elementId: FOOTNOTE_WITHOUT_BACKLINK_ID,
    },
  },
  {
    kind: "paragraph",
    id: ENDNOTE_WITH_BACKLINK_ID,
    noteKind: "endnote",
    runs: [
      {
        text: "3　这条尾注位于独立章节，用来验证跨章节定位以及重新分页后的稳定返回。 ",
      },
      {
        text: "↩ 返回",
        link: {
          kind: "note-backlink",
          target: {
            sectionId: "opening",
            blockId: NOTE_REFERENCE_BLOCK_ID,
            offset: endnoteReferenceOffset,
          },
          noteKind: "endnote",
          label: "3",
        },
      },
    ],
    source: {
      scheme: "fixture",
      documentId: "notes",
      elementId: ENDNOTE_WITH_BACKLINK_ID,
    },
  },
];

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
              ...(index % 7 === 0 ? { marks: ["emphasis"] as const } : {}),
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
  revisionId: "persimmon-sample-v3",
  title: "柿子熟了",
  navigation: [
    {
      id: "nav-opening",
      label: "开始阅读",
      target: {
        sectionId: "opening",
        blockId: "opening-heading",
        offset: 0,
      },
    },
    {
      id: "nav-notes",
      label: "脚注与尾注测试",
      target: {
        sectionId: "notes",
        blockId: "notes-heading",
        offset: 0,
      },
    },
    {
      id: "nav-reading",
      label: "一段安静的试读",
      target: {
        sectionId: "reading",
        blockId: "reading-heading",
        offset: 0,
      },
    },
  ],
  sections: [
    {
      ...SAMPLE_BOOK.sections[0]!,
      blocks: [
        ...SAMPLE_BOOK.sections[0]!.blocks.slice(0, 2),
        noteReferenceBlock,
        ...SAMPLE_BOOK.sections[0]!.blocks.slice(2),
      ],
    },
    {
      id: "notes",
      title: "脚注与尾注测试",
      blocks: [
        {
          kind: "heading",
          id: "notes-heading",
          level: 1,
          runs: [{ text: "脚注与尾注测试" }],
          source: {
            scheme: "fixture",
            documentId: "notes",
            elementId: "notes-heading",
          },
        },
        ...noteBlocks,
      ],
    },
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
