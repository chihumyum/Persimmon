export const BOOK_IR_VERSION = 1 as const;

export interface BookIR {
  schemaVersion: typeof BOOK_IR_VERSION;
  id: string;
  revisionId: string;
  title: string;
  language?: string;
  sections: readonly SectionIR[];
  assets: Readonly<Record<string, ImageAssetIR>>;
  fontFamilies?: Readonly<Record<string, BookFontFamilyIR>>;
  coverAssetId?: string;
  navigation?: readonly BookNavigationItem[];
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
  noteKind?: NoteKind;
  style?: BlockStyleIR;
  source?: ExternalSourceRef;
}

export interface HeadingBlockIR {
  kind: "heading";
  id: string;
  level: 1 | 2 | 3;
  runs: readonly InlineRunIR[];
  noteKind?: NoteKind;
  style?: BlockStyleIR;
  source?: ExternalSourceRef;
}

export interface ImageBlockIR {
  kind: "image";
  id: string;
  assetId: string;
  alt: string;
  intrinsicSize?: Size;
  style?: BlockStyleIR;
  source?: ExternalSourceRef;
}

/**
 * Safe, renderer-independent subset of EPUB author styles.
 *
 * Lengths are normalized to em so import never leaks CSS units or executable
 * browser styling into the reader core.
 */
export interface BlockStyleIR {
  textAlign?: "start" | "center" | "justify" | "end";
  fontWeight?: 400 | 700;
  fontStyle?: "normal" | "italic";
  marginBeforeEm?: number;
  marginAfterEm?: number;
}

export type InlineMark = "strong" | "emphasis";

export type NoteKind = "footnote" | "endnote";

export type InternalLinkKind = "internal" | "note-reference" | "note-backlink";

export interface InternalLinkIR {
  kind: InternalLinkKind;
  target: BookPosition;
  noteKind?: NoteKind;
  /**
   * Human-readable source label before any visual superscript normalization.
   */
  label: string;
}

export interface InlineRunIR {
  text: string;
  marks?: readonly InlineMark[];
  verticalAlign?: "superscript" | "subscript";
  link?: InternalLinkIR;
  /**
   * Refers to a publisher-provided EPUB font. Renderers apply it only when
   * the reader has explicitly enabled book fonts.
   */
  bookFontFamilyId?: string;
}

export interface ImageAssetIR {
  id: string;
  mediaType: string;
  byteLength?: number;
}

export interface BookFontFaceIR {
  id: string;
  familyId: string;
  resourceId: string;
  mediaType: string;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}

export interface BookFontFamilyIR {
  id: string;
  cssFamily: string;
  faces: readonly BookFontFaceIR[];
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

export interface BookNavigationItem {
  id: string;
  label: string;
  target: BookPosition;
  children?: readonly BookNavigationItem[];
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
