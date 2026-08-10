export type ReaderProgressDisplay = "footer" | "header" | "both" | "hidden";
export type ReaderTextAlignment = "book" | "start" | "justify" | "end";

export interface ReaderAppearance {
  readonly fontFamily: string;
  /** Optional fixed family for reader chrome painted into page textures. */
  readonly decorationFontFamily?: string;
  readonly bookFontFamilyNames?: Readonly<Record<string, string>>;
  readonly fontSize: number;
  readonly lineHeight: number;
  /** Gap between adjacent body paragraphs, measured in em. */
  readonly paragraphSpacing: number;
  /** Symmetric start/end padding on the text inline axis, in layout pixels. */
  readonly inlineMargin: number;
  readonly textAlignment: ReaderTextAlignment;
  readonly progressDisplay: ReaderProgressDisplay;
}

export const DEFAULT_LIVE_READER_APPEARANCE: ReaderAppearance = {
  fontFamily: "Noto Serif SC",
  fontSize: 20,
  lineHeight: 1.65,
  paragraphSpacing: 0.9,
  inlineMargin: 32,
  textAlignment: "book",
  progressDisplay: "footer",
};
