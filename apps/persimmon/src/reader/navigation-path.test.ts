import { BOOK_IR_VERSION, type BookIR } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import {
  navigationLabelsForPosition,
  navigationPathForPosition,
} from "./navigation-path";

const book: BookIR = {
  schemaVersion: BOOK_IR_VERSION,
  id: "navigation-path",
  revisionId: "v1",
  title: "整本书",
  assets: {},
  sections: [
    {
      id: "first",
      blocks: [
        { kind: "paragraph", id: "preface", runs: [{ text: "序" }] },
        { kind: "heading", id: "chapter", level: 1, runs: [{ text: "章" }] },
        { kind: "heading", id: "topic", level: 2, runs: [{ text: "节" }] },
      ],
    },
    {
      id: "second",
      blocks: [
        { kind: "heading", id: "next", level: 1, runs: [{ text: "下一部" }] },
      ],
    },
  ],
  navigation: [
    {
      id: "part",
      label: "第一部",
      target: { sectionId: "first", blockId: "chapter", offset: 0 },
      children: [
        {
          id: "chapter",
          label: "第一章",
          target: { sectionId: "first", blockId: "chapter", offset: 0 },
          children: [
            {
              id: "topic",
              label: "第一节",
              target: { sectionId: "first", blockId: "topic", offset: 0 },
            },
          ],
        },
      ],
    },
    {
      id: "next",
      label: "第二部",
      target: { sectionId: "second", blockId: "next", offset: 0 },
    },
  ],
};

describe("reader toolbar navigation path", () => {
  it("returns every active TOC level from highest to deepest", () => {
    expect(
      navigationLabelsForPosition(book, {
        sectionId: "first",
        blockId: "topic",
        offset: 1,
      }),
    ).toEqual(["第一部", "第一章", "第一节"]);
  });

  it("chooses the deepest item when nested entries share a target", () => {
    expect(
      navigationLabelsForPosition(book, {
        sectionId: "first",
        blockId: "chapter",
        offset: 0,
      }),
    ).toEqual(["第一部", "第一章"]);
    expect(
      navigationPathForPosition(book, {
        sectionId: "first",
        blockId: "chapter",
        offset: 0,
      }).map((item) => item.id),
    ).toEqual(["part", "chapter"]);
  });

  it("moves to the next root and returns no path before the first target", () => {
    expect(
      navigationLabelsForPosition(book, {
        sectionId: "second",
        blockId: "next",
        offset: 0,
      }),
    ).toEqual(["第二部"]);
    expect(
      navigationLabelsForPosition(book, {
        sectionId: "first",
        blockId: "preface",
        offset: 0,
      }),
    ).toEqual([]);
  });
});
