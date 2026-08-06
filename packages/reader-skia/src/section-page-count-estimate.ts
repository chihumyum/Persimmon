import {
  isTextBlock,
  type BlockIR,
  type SectionIR,
  type TextBlockIR,
} from "@persimmon/book-core";
import type { PageLayoutSpec, TypographyPreset } from "@persimmon/layout";

export const NATIVE_EXACT_PUBLICATION_BLOCK_LIMIT = 64;

export function shouldResolveExactPublicationPageCounts(
  sections: readonly SectionIR[],
): boolean {
  return (
    sections.reduce((total, section) => total + section.blocks.length, 0) <=
    NATIVE_EXACT_PUBLICATION_BLOCK_LIMIT
  );
}

/**
 * Produces an immediate, allocation-light page-count estimate while exact
 * SkParagraph measurement runs incrementally after the first paint.
 */
export function estimateSectionPageCount(
  section: SectionIR,
  spec: PageLayoutSpec,
): number {
  const contentWidth = Math.max(
    1,
    spec.viewport.width - spec.padding.left - spec.padding.right,
  );
  const contentHeight = Math.max(
    1,
    spec.viewport.height - spec.padding.top - spec.padding.bottom,
  );
  let estimatedHeight = 0;
  let previousBlock: BlockIR | undefined;

  for (const block of section.blocks) {
    estimatedHeight += estimatedGapBefore(block, previousBlock, spec);
    if (isTextBlock(block)) {
      const style = typographyForBlock(block, spec);
      const lineCapacity = Math.max(1, contentWidth / style.fontSize);
      const lineCount = Math.max(
        1,
        Math.ceil(textBlockWidthUnits(block) / lineCapacity),
      );
      estimatedHeight += lineCount * style.fontSize * style.heightMultiplier;
    } else {
      const aspectRatio = block.intrinsicSize
        ? block.intrinsicSize.width / block.intrinsicSize.height
        : 4 / 3;
      estimatedHeight += Math.min(
        contentWidth / Math.max(0.01, aspectRatio),
        contentHeight * spec.imageMaxHeightRatio,
      );
    }
    previousBlock = block;
  }

  return Math.max(1, Math.ceil(estimatedHeight / contentHeight));
}

function typographyForBlock(
  block: TextBlockIR,
  spec: PageLayoutSpec,
): TypographyPreset {
  return block.kind === "heading"
    ? spec.headings[block.level]
    : block.noteKind
      ? spec.note
      : spec.body;
}

function textBlockWidthUnits(block: TextBlockIR): number {
  let units = 0;
  for (const run of block.runs) {
    for (const character of run.text) {
      const codePoint = character.codePointAt(0) ?? 0;
      if (/\s/u.test(character)) {
        units += 0.35;
      } else if (codePoint <= 0x7f) {
        units += 0.55;
      } else {
        units += 1;
      }
    }
  }
  return units;
}

function estimatedGapBefore(
  block: BlockIR,
  previousBlock: BlockIR | undefined,
  spec: PageLayoutSpec,
): number {
  if (!previousBlock) {
    return 0;
  }
  if (previousBlock.kind === "heading") {
    return spec.headingAfter;
  }
  if (block.kind === "heading") {
    return spec.headingBefore;
  }
  if (block.kind === "image" || previousBlock.kind === "image") {
    return spec.imageGap;
  }
  return spec.paragraphGap;
}
