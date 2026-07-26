import type { SectionIR } from "@persimmon/book-core";
import { createDefaultPageLayoutSpec } from "@persimmon/layout";
import { describe, expect, it } from "vitest";

import {
  NATIVE_EXACT_PUBLICATION_BLOCK_LIMIT,
  estimateSectionPageCount,
  shouldResolveExactPublicationPageCounts,
} from "./section-page-count-estimate";

describe("estimateSectionPageCount", () => {
  const spec = {
    ...createDefaultPageLayoutSpec({ width: 120, height: 100 }),
    padding: { top: 0, right: 10, bottom: 0, left: 10 },
    body: {
      ...createDefaultPageLayoutSpec({ width: 120, height: 100 }).body,
      fontSize: 10,
      heightMultiplier: 1,
    },
  };

  it("estimates text pages without allocating paragraph handles", () => {
    const section: SectionIR = {
      id: "chapter",
      blocks: [
        {
          kind: "paragraph",
          id: "body",
          runs: [{ text: "柿".repeat(250) }],
        },
      ],
    };

    expect(estimateSectionPageCount(section, spec)).toBe(3);
  });

  it("accounts for image height and normalizes empty sections", () => {
    const imageSection: SectionIR = {
      id: "images",
      blocks: [
        {
          kind: "image",
          id: "cover",
          assetId: "cover",
          alt: "Cover",
          intrinsicSize: { width: 100, height: 100 },
        },
      ],
    };

    expect(estimateSectionPageCount(imageSection, spec)).toBe(1);
    expect(estimateSectionPageCount({ id: "empty", blocks: [] }, spec)).toBe(1);
  });

  it("bounds exact background pagination on native platforms", () => {
    const sections = Array.from(
      { length: NATIVE_EXACT_PUBLICATION_BLOCK_LIMIT + 1 },
      (_, index): SectionIR => ({
        id: `${index}`,
        blocks: [
          {
            kind: "paragraph",
            id: `block-${index}`,
            runs: [{ text: "柿" }],
          },
        ],
      }),
    );

    expect(shouldResolveExactPublicationPageCounts("android", sections)).toBe(
      false,
    );
    expect(shouldResolveExactPublicationPageCounts("ios", sections)).toBe(
      false,
    );
    expect(shouldResolveExactPublicationPageCounts("web", sections)).toBe(true);
  });
});
