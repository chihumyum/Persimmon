import { isTextBlock, validateBookIR } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import { DEMO_BOOK } from "./demo-book";

describe("built-in demo book", () => {
  it("contains valid footnote and endnote navigation fixtures", () => {
    expect(validateBookIR(DEMO_BOOK)).toEqual([]);

    const textBlocks = DEMO_BOOK.sections.flatMap((section) =>
      section.blocks.filter(isTextBlock),
    );
    const links = textBlocks.flatMap((block) =>
      block.runs.flatMap((run) => (run.link ? [run.link] : [])),
    );
    const references = links.filter((link) => link.kind === "note-reference");
    const backlinks = links.filter((link) => link.kind === "note-backlink");

    expect(references.map((link) => link.noteKind)).toEqual([
      "footnote",
      "footnote",
      "endnote",
    ]);
    expect(backlinks.map((link) => link.noteKind)).toEqual([
      "footnote",
      "endnote",
    ]);
  });
});
