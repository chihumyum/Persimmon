export const BOOK_IR_VERSION = 1 as const;

export interface BookIR {
  schemaVersion: typeof BOOK_IR_VERSION;
  id: string;
  revisionId: string;
  title: string;
  language?: string;
  sections: readonly SectionIR[];
  assets: Readonly<Record<string, ImageAssetIR>>;
}

export interface SectionIR {
  id: string;
  title?: string;
  blocks: readonly BlockIR[];
}

export type BlockIR = ParagraphBlockIR | HeadingBlockIR | ImageBlockIR;

export type TextBlockIR = ParagraphBlockIR | HeadingBlockIR;

export interface ParagraphBlockIR {
  kind: "paragraph";
  id: string;
  runs: readonly InlineRunIR[];
  source?: ExternalSourceRef;
}

export interface HeadingBlockIR {
  kind: "heading";
  id: string;
  level: 1 | 2 | 3;
  runs: readonly InlineRunIR[];
  source?: ExternalSourceRef;
}

export interface ImageBlockIR {
  kind: "image";
  id: string;
  assetId: string;
  alt: string;
  intrinsicSize?: Size;
  source?: ExternalSourceRef;
}

export type InlineMark = "strong" | "emphasis";

export interface InlineRunIR {
  text: string;
  marks?: readonly InlineMark[];
}

export interface ImageAssetIR {
  id: string;
  mediaType: string;
  byteLength?: number;
}

export interface ExternalSourceRef {
  scheme: "fixture" | "epub" | "drifting";
  documentId: string;
  elementId: string;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * A stable location within an immutable BookIR revision.
 *
 * Text block offsets use JavaScript UTF-16 code units. Atomic non-text blocks
 * currently have a logical length of one: offset 0 is before the block and
 * offset 1 is after it.
 */
export interface BookPosition {
  sectionId: string;
  blockId: string;
  offset: number;
}

export interface BookLocator {
  bookId: string;
  revisionId: string;
  position: BookPosition;
  affinity?: "forward" | "backward";
}

/**
 * A left-closed, right-open range inside one block.
 */
export interface SourceSpan {
  sectionId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
}

export function isTextBlock(block: BlockIR): block is TextBlockIR {
  return block.kind === "paragraph" || block.kind === "heading";
}

export function textOf(block: TextBlockIR): string {
  return block.runs.map((run) => run.text).join("");
}

export function logicalLength(block: BlockIR): number {
  return isTextBlock(block) ? textOf(block).length : 1;
}
