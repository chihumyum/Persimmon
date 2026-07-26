export type ReaderProgressDisplay = "footer" | "header" | "both" | "hidden";

export interface ReaderAppearance {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  /** Gap between adjacent body paragraphs, measured in em. */
  readonly paragraphSpacing: number;
  /** Left and right page padding, measured in layout pixels. */
  readonly horizontalMargin: number;
  readonly progressDisplay: ReaderProgressDisplay;
}

export const DEFAULT_LIVE_READER_APPEARANCE: ReaderAppearance = {
  fontFamily: "Noto Serif SC",
  fontSize: 20,
  lineHeight: 1.65,
  paragraphSpacing: 0.9,
  horizontalMargin: 32,
  progressDisplay: "footer",
};
