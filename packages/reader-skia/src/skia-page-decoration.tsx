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
import { Platform } from "react-native";

import type { ReaderProgressDisplay } from "./reader-appearance";
import {
  progressDisplayHasFooter,
  progressDisplayHasHeader,
  type PageProgressPresentation,
  type PageProgressDecoration,
} from "./page-progress-decoration";
import { afterSkiaPaint } from "./skia-lifecycle";
import { DEFAULT_READER_THEME, type ReaderTheme } from "./reader-theme";
import {
  releaseRetiredSkiaResources,
  releaseSkiaResources,
} from "./skia-resource-release";

const DECORATION_FONT_SIZE = 12;
const DECORATION_HEIGHT_MULTIPLIER = 1.3;

interface PageDecorationText {
  readonly paragraph: SkParagraph;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface SkiaPageDecoration {
  readonly headerTitle: PageDecorationText;
  readonly footerPage: PageDecorationText;
  readonly footerPercentage: PageDecorationText;
  dispose(): void;
  retire(): void;
}

export interface CreateSkiaPageDecorationInput {
  readonly model: PageProgressDecoration;
  readonly fontProvider: SkTypefaceFontProvider;
  readonly fontFamily: string;
  readonly width: number;
  readonly height: number;
  readonly horizontalMargin: number;
  readonly pagesPerView?: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly theme?: ReaderTheme;
}

export function createSkiaPageDecoration({
  model,
  fontProvider,
  fontFamily,
  width,
  height,
  horizontalMargin,
  pagesPerView = 1,
  topInset,
  bottomInset,
  theme = DEFAULT_READER_THEME,
}: CreateSkiaPageDecorationInput): SkiaPageDecoration {
  const normalizedPagesPerView = Math.max(1, Math.floor(pagesPerView));
  const pageWidth = width / normalizedPagesPerView;
  const maximumHorizontalMargin = Math.max(8, (pageWidth - 96) / 2);
  const margin = Math.min(horizontalMargin, maximumHorizontalMargin);
  const contentWidth = Math.max(1, pageWidth - margin * 2);
  const headerY = topInset + 12;
  const footerX = width - pageWidth + margin;

  const headerTitle = createDecorationParagraph(
    model.sectionTitle,
    contentWidth,
    TextAlign.Start,
    0.2,
    fontProvider,
    fontFamily,
    theme.decoration,
  );
  const footerPage = createDecorationParagraph(
    model.pageLabel,
    contentWidth,
    TextAlign.Center,
    0.5,
    fontProvider,
    fontFamily,
    theme.decoration,
  );
  const footerPercentage = createDecorationParagraph(
    model.percentageLabel,
    contentWidth,
    TextAlign.Center,
    0.5,
    fontProvider,
    fontFamily,
    theme.decoration,
  );
  let disposed = false;
  const release = (retired: boolean) => {
    if (disposed) {
      return;
    }
    disposed = true;
    if (retired) {
      releaseRetiredSkiaResources(headerTitle, footerPage);
      releaseRetiredSkiaResources(footerPercentage);
      return;
    }
    releaseSkiaResources(Platform.OS, headerTitle, footerPage);
    releaseSkiaResources(Platform.OS, footerPercentage, null);
  };

  return {
    headerTitle: {
      paragraph: headerTitle,
      x: margin,
      y: headerY,
      width: contentWidth,
    },
    footerPage: {
      paragraph: footerPage,
      x: footerX,
      y: height - bottomInset - 12 - footerPage.getHeight(),
      width: contentWidth,
    },
    footerPercentage: {
      paragraph: footerPercentage,
      x: footerX,
      y: height - bottomInset - 12 - footerPercentage.getHeight(),
      width: contentWidth,
    },
    dispose() {
      release(false);
    },
    retire() {
      release(true);
    },
  };
}

export function disposeSkiaPageDecorationAfterPaint(
  decoration: SkiaPageDecoration,
): void {
  afterSkiaPaint(() => decoration.dispose());
}

export function retireSkiaPageDecorationAfterPaint(
  decoration: SkiaPageDecoration,
): void {
  afterSkiaPaint(() => decoration.retire());
}

export function drawSkiaPageDecoration(
  canvas: SkCanvas,
  decoration: SkiaPageDecoration,
  display: ReaderProgressDisplay,
  presentation: PageProgressPresentation = "reading",
  offsetX = 0,
): void {
  if (progressDisplayHasHeader(display)) {
    paintDecorationText(canvas, decoration.headerTitle, offsetX);
  }
  if (progressDisplayHasFooter(display)) {
    paintDecorationText(
      canvas,
      presentation === "toolbar"
        ? decoration.footerPercentage
        : decoration.footerPage,
      offsetX,
    );
  }
}

export function SkiaPageDecorationLayer({
  decoration,
  display,
  presentation = "reading",
  offsetX = 0,
}: {
  readonly decoration: SkiaPageDecoration;
  readonly display: ReaderProgressDisplay;
  readonly presentation?: PageProgressPresentation;
  readonly offsetX?: number;
}) {
  return (
    <>
      {progressDisplayHasHeader(display) ? (
        <Paragraph
          paragraph={decoration.headerTitle.paragraph}
          x={decoration.headerTitle.x + offsetX}
          y={decoration.headerTitle.y}
          width={decoration.headerTitle.width}
        />
      ) : null}
      {progressDisplayHasFooter(display) ? (
        <Paragraph
          paragraph={
            presentation === "toolbar"
              ? decoration.footerPercentage.paragraph
              : decoration.footerPage.paragraph
          }
          x={
            presentation === "toolbar"
              ? decoration.footerPercentage.x + offsetX
              : decoration.footerPage.x + offsetX
          }
          y={
            presentation === "toolbar"
              ? decoration.footerPercentage.y
              : decoration.footerPage.y
          }
          width={
            presentation === "toolbar"
              ? decoration.footerPercentage.width
              : decoration.footerPage.width
          }
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
  color: string,
): SkParagraph {
  const textStyle: SkTextStyle = {
    color: Skia.Color(color),
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
  offsetX: number,
): void {
  decoration.paragraph.paint(canvas, decoration.x + offsetX, decoration.y);
}
