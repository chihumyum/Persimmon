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

  it("validates publisher font references without treating them as images", () => {
    const fontFamilyId = "epub-font-family:test";
    const valid = {
      ...SAMPLE_BOOK,
      fontFamilies: {
        [fontFamilyId]: {
          id: fontFamilyId,
          cssFamily: "Publisher Serif",
          faces: [
            {
              id: "epub-font-face:test",
              familyId: fontFamilyId,
              resourceId: "epub-font:test",
              mediaType: "font/ttf",
              weight: 400 as const,
              style: "normal" as const,
            },
          ],
        },
      },
      sections: SAMPLE_BOOK.sections.map((section, sectionIndex) =>
        sectionIndex === 0
          ? {
              ...section,
              blocks: section.blocks.map((block, blockIndex) =>
                blockIndex === 0 && block.kind !== "image"
                  ? {
                      ...block,
                      runs: block.runs.map((run, runIndex) =>
                        runIndex === 0
                          ? { ...run, bookFontFamilyId: fontFamilyId }
                          : run,
                      ),
                    }
                  : block,
              ),
            }
          : section,
      ),
    };
    expect(validateBookIR(valid)).toEqual([]);
    expect(
      validateBookIR({
        ...valid,
        fontFamilies: undefined,
      }).map((issue) => issue.code),
    ).toContain("missing-font-family");
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

  it("rejects block styles outside the renderer-safe whitelist", () => {
    const invalid = {
      ...SAMPLE_BOOK,
      sections: [
        {
          id: "styled-section",
          blocks: [
            {
              kind: "paragraph",
              id: "styled",
              runs: [{ text: "柿" }],
              style: {
                textAlign: "absolute",
                marginBeforeEm: 99,
              },
            },
          ],
        },
      ],
    } as unknown as BookIR;

    expect(validateBookIR(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-block-style" }),
      ]),
    );
  });
});
