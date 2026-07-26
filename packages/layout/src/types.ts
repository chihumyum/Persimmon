import type {
  BookPosition,
  InternalLinkIR,
  InlineMark,
  NoteKind,
  Size,
  SourceSpan,
} from "@persimmon/book-core";

export interface Rect extends Size {
  x: number;
  y: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TypographyPreset {
  fontFamilies: readonly string[];
  fontSize: number;
  heightMultiplier: number;
  weight?: 400 | 500 | 600 | 700;
  style?: "normal" | "italic";
  align?: "start" | "center" | "justify";
}

export interface PageLayoutSpec {
  viewport: Size;
  padding: Insets;
  body: TypographyPreset;
  note: TypographyPreset;
  headings: Readonly<Record<1 | 2 | 3, TypographyPreset>>;
  paragraphGap: number;
  headingBefore: number;
  headingAfter: number;
  imageGap: number;
  imageMaxHeightRatio: number;
  minBodyLinesAfterHeading: number;
}

export interface ResolvedRun {
  text: string;
  startOffset: number;
  endOffset: number;
  marks: readonly InlineMark[];
  verticalAlign?: "superscript" | "subscript";
  link?: InternalLinkIR;
}

export interface ParagraphLayoutInput {
  key: string;
  text: string;
  runs: readonly ResolvedRun[];
  width: number;
  style: TypographyPreset;
}

/**
 * All offsets exposed by this interface use JavaScript UTF-16 code units.
 * A Skia implementation is responsible for normalizing any backend-specific
 * text-buffer indexes before returning them.
 */
export interface MeasuredParagraph<THandle> {
  key: string;
  handle: THandle;
  width: number;
  height: number;
  lines: readonly MeasuredLine[];
  hitTest(x: number, y: number): number;
  rectsForRange(startOffset: number, endOffset: number): readonly Rect[];
}

export interface MeasuredLine {
  startOffset: number;
  endOffset: number;
  visibleEndOffset: number;
  top: number;
  bottom: number;
  baseline: number;
}

export interface ParagraphLayoutBackend<THandle> {
  layout(input: ParagraphLayoutInput): MeasuredParagraph<THandle>;
}

export interface ParagraphSliceScene {
  kind: "paragraph-slice";
  paragraphKey: string;
  sectionId: string;
  blockId: string;
  source: SourceSpan;
  frame: Rect;
  sourceTop: number;
  noteKind?: NoteKind;
}

export interface SceneImage {
  kind: "image";
  sectionId: string;
  blockId: string;
  source: SourceSpan;
  assetId: string;
  alt: string;
  frame: Rect;
}

export type PageSceneItem = ParagraphSliceScene | SceneImage;

export interface PageLinkRegion {
  source: BookPosition;
  link: InternalLinkIR;
  frame: Rect;
}

export interface PageScene {
  index: number;
  size: Size;
  contentRect: Rect;
  items: readonly PageSceneItem[];
  links?: readonly PageLinkRegion[];
  start: BookPosition;
  end: BookPosition;
}

export interface PageLocationIndex {
  pageFor(position: BookPosition): number | undefined;
  positionAtPageStart(pageIndex: number): BookPosition;
}

export interface PaginationResult<TParagraphHandle> {
  pages: readonly PageScene[];
  paragraphs: ReadonlyMap<string, MeasuredParagraph<TParagraphHandle>>;
  locationIndex: PageLocationIndex;
}

export function createDefaultPageLayoutSpec(viewport: Size): PageLayoutSpec {
  const body: TypographyPreset = {
    fontFamilies: ["Noto Serif SC", "serif"],
    fontSize: 20,
    heightMultiplier: 1.65,
    weight: 400,
    align: "start",
  };

  return {
    viewport,
    padding: { top: 52, right: 32, bottom: 52, left: 32 },
    body,
    note: {
      ...body,
      fontSize: 17,
      heightMultiplier: 1.55,
    },
    headings: {
      1: {
        ...body,
        fontSize: 34,
        heightMultiplier: 1.25,
        weight: 700,
      },
      2: {
        ...body,
        fontSize: 28,
        heightMultiplier: 1.3,
        weight: 700,
      },
      3: {
        ...body,
        fontSize: 24,
        heightMultiplier: 1.35,
        weight: 600,
      },
    },
    paragraphGap: 18,
    headingBefore: 28,
    headingAfter: 22,
    imageGap: 22,
    imageMaxHeightRatio: 0.72,
    minBodyLinesAfterHeading: 2,
  };
}
