import { describe, expect, it } from "vitest";

import {
  SAMPLE_BOOK,
  assertValidBookIR,
  validateBookIR,
  type BookIR,
} from "./index";

describe("BookIR validation", () => {
  it("accepts the sample fixture", () => {
    expect(validateBookIR(SAMPLE_BOOK)).toEqual([]);
    expect(() => assertValidBookIR(SAMPLE_BOOK)).not.toThrow();
  });

  it("rejects duplicate block ids", () => {
    const duplicate: BookIR = {
      ...SAMPLE_BOOK,
      sections: [
        {
          id: "duplicate-section",
          blocks: [
            { kind: "paragraph", id: "same", runs: [{ text: "一" }] },
            { kind: "paragraph", id: "same", runs: [{ text: "二" }] },
          ],
        },
      ],
    };

    expect(validateBookIR(duplicate)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-block-id" }),
      ]),
    );
  });
});
