import {
  FontWeight,
  Paragraph,
  Skia,
  TextAlign,
  type SkCanvas,
  type SkParagraph,
  type SkParagraphStyle,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";

import type { ReaderProgressDisplay } from "./reader-appearance";
import {
  progressDisplayHasFooter,
  progressDisplayHasHeader,
  type PageProgressDecoration,
} from "./page-progress-decoration";
import { afterSkiaPaint } from "./skia-lifecycle";

const DECORATION_COLOR = "#8b8177";
const DECORATION_FONT_SIZE = 12;
const DECORATION_HEIGHT_MULTIPLIER = 1.3;
const HEADER_GAP = 12;
const HEADER_PROGRESS_WIDTH = 48;

interface PageDecorationText {
  readonly paragraph: SkParagraph;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface SkiaPageDecoration {
  readonly headerTitle: PageDecorationText;
  readonly headerProgress: PageDecorationText;
  readonly footer: PageDecorationText;
  dispose(): void;
}

export interface CreateSkiaPageDecorationInput {
  readonly model: PageProgressDecoration;
  readonly fontProvider: SkTypefaceFontProvider;
  readonly fontFamily: string;
  readonly width: number;
  readonly height: number;
  readonly horizontalMargin: number;
  readonly topInset: number;
  readonly bottomInset: number;
}

export function createSkiaPageDecoration({
  model,
  fontProvider,
  fontFamily,
  width,
  height,
  horizontalMargin,
  topInset,
  bottomInset,
}: CreateSkiaPageDecorationInput): SkiaPageDecoration {
  const maximumHorizontalMargin = Math.max(8, (width - 96) / 2);
  const margin = Math.min(horizontalMargin, maximumHorizontalMargin);
  const contentWidth = Math.max(1, width - margin * 2);
  const titleWidth = Math.max(
    1,
    contentWidth - HEADER_GAP - HEADER_PROGRESS_WIDTH,
  );
  const progressWidth = Math.max(1, contentWidth - titleWidth - HEADER_GAP);
  const headerY = topInset + 12;

  const headerTitle = createDecorationParagraph(
    model.sectionTitle,
    titleWidth,
    TextAlign.Start,
    0.2,
    fontProvider,
    fontFamily,
  );
  const headerProgress = createDecorationParagraph(
    model.percentageLabel,
    progressWidth,
    TextAlign.End,
    0.5,
    fontProvider,
    fontFamily,
  );
  const footer = createDecorationParagraph(
    model.footerLabel,
    contentWidth,
    TextAlign.Center,
    0.5,
    fontProvider,
    fontFamily,
  );
  let disposed = false;

  return {
    headerTitle: {
      paragraph: headerTitle,
      x: margin,
      y: headerY,
      width: titleWidth,
    },
    headerProgress: {
      paragraph: headerProgress,
      x: margin + titleWidth + HEADER_GAP,
      y: headerY,
      width: progressWidth,
    },
    footer: {
      paragraph: footer,
      x: margin,
      y: height - bottomInset - 12 - footer.getHeight(),
      width: contentWidth,
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      headerTitle.dispose();
      headerProgress.dispose();
      footer.dispose();
    },
  };
}

export function disposeSkiaPageDecorationAfterPaint(
  decoration: SkiaPageDecoration,
): void {
  afterSkiaPaint(() => decoration.dispose());
}

export function drawSkiaPageDecoration(
  canvas: SkCanvas,
  decoration: SkiaPageDecoration,
  display: ReaderProgressDisplay,
): void {
  if (progressDisplayHasHeader(display)) {
    paintDecorationText(canvas, decoration.headerTitle);
    paintDecorationText(canvas, decoration.headerProgress);
  }
  if (progressDisplayHasFooter(display)) {
    paintDecorationText(canvas, decoration.footer);
  }
}

export function SkiaPageDecorationLayer({
  decoration,
  display,
}: {
  readonly decoration: SkiaPageDecoration;
  readonly display: ReaderProgressDisplay;
}) {
  return (
    <>
      {progressDisplayHasHeader(display) ? (
        <>
          <Paragraph
            paragraph={decoration.headerTitle.paragraph}
            x={decoration.headerTitle.x}
            y={decoration.headerTitle.y}
            width={decoration.headerTitle.width}
          />
          <Paragraph
            paragraph={decoration.headerProgress.paragraph}
            x={decoration.headerProgress.x}
            y={decoration.headerProgress.y}
            width={decoration.headerProgress.width}
          />
        </>
      ) : null}
      {progressDisplayHasFooter(display) ? (
        <Paragraph
          paragraph={decoration.footer.paragraph}
          x={decoration.footer.x}
          y={decoration.footer.y}
          width={decoration.footer.width}
        />
      ) : null}
    </>
  );
}

function createDecorationParagraph(
  text: string,
  width: number,
  textAlign: TextAlign,
  letterSpacing: number,
  fontProvider: SkTypefaceFontProvider,
  fontFamily: string,
): SkParagraph {
  const textStyle: SkTextStyle = {
    color: Skia.Color(DECORATION_COLOR),
    fontFamilies: [fontFamily],
    fontSize: DECORATION_FONT_SIZE,
    fontStyle: {
      weight: FontWeight.Normal,
    },
    heightMultiplier: DECORATION_HEIGHT_MULTIPLIER,
    letterSpacing,
    locale: "zh-CN",
  };
  const paragraphStyle: SkParagraphStyle = {
    ellipsis: "…",
    maxLines: 1,
    textAlign,
    textStyle,
  };
  const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontProvider);
  builder.addText(text);
  const paragraph = builder.build();
  if (typeof builder.dispose === "function") {
    builder.dispose();
  }
  paragraph.layout(width);
  return paragraph;
}

function paintDecorationText(
  canvas: SkCanvas,
  decoration: PageDecorationText,
): void {
  decoration.paragraph.paint(canvas, decoration.x, decoration.y);
}
