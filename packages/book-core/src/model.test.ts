import { describe, expect, it } from "vitest";

import {
  BOOK_IR_VERSION,
  logicalLength,
  textOf,
  type ParagraphBlockIR,
} from "./index";
import { SAMPLE_BOOK } from "./test-fixtures/sample-book";

describe("BookIR text coordinates", () => {
  it("uses JavaScript UTF-16 offsets", () => {
    const block: ParagraphBlockIR = {
      kind: "paragraph",
      id: "utf16",
      runs: [{ text: "A柿🍊B" }],
    };

    expect(textOf(block)).toBe("A柿🍊B");
    expect(logicalLength(block)).toBe(5);
    expect("A柿🍊B".slice(2, 4)).toBe("🍊");
  });

  it("gives atomic image blocks a logical length of one", () => {
    const image = SAMPLE_BOOK.sections[0]?.blocks.find(
      (block) => block.kind === "image",
    );

    expect(image).toBeDefined();
    expect(image && logicalLength(image)).toBe(1);
    expect(SAMPLE_BOOK.schemaVersion).toBe(BOOK_IR_VERSION);
  });
});
