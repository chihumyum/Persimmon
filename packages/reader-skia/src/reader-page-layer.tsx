import type { PageScene, PaginationResult } from "@persimmon/layout";
import {
  Group,
  Image as SkiaImage,
  Paragraph,
  Rect,
  RoundedRect,
  type SkParagraph,
  type Transforms3d,
} from "@shopify/react-native-skia";
import type { DerivedValue } from "react-native-reanimated";

import type { DecodedImageCache } from "./image-cache";
import type { ReaderProgressDisplay } from "./reader-appearance";
import { DEFAULT_READER_THEME, type ReaderTheme } from "./reader-theme";
import {
  SkiaPageDecorationLayer,
  type SkiaPageDecoration,
} from "./skia-page-decoration";
import type { PageProgressPresentation } from "./page-progress-decoration";

interface ReaderPageLayerProps {
  readonly page: PageScene;
  readonly pagination: PaginationResult<SkParagraph>;
  readonly imageCache: DecodedImageCache;
  readonly decoration?: SkiaPageDecoration;
  readonly decorationClipHeight?: number;
  readonly decorationClipWidth?: number;
  readonly decorationOffsetX?: number;
  readonly progressDisplay?: ReaderProgressDisplay;
  readonly progressPresentation?: PageProgressPresentation;
  readonly offsetX?: number;
  readonly translateX?: DerivedValue<Transforms3d>;
  readonly theme?: ReaderTheme;
}

export function ReaderPageLayer({
  page,
  pagination,
  imageCache,
  decoration,
  decorationClipHeight,
  decorationClipWidth,
  decorationOffsetX = 0,
  progressDisplay = "hidden",
  progressPresentation = "reading",
  offsetX = 0,
  translateX,
  theme = DEFAULT_READER_THEME,
}: ReaderPageLayerProps) {
  return (
    <Group transform={translateX}>
      <Group transform={[{ translateX: offsetX }]}>
        {page.items.map((item, itemIndex) => {
          if (item.kind === "image") {
            const image = imageCache.get(item.assetId);
            if (image) {
              return (
                <SkiaImage
                  key={`${item.blockId}:${itemIndex}`}
                  image={image}
                  x={item.frame.x}
                  y={item.frame.y}
                  width={item.frame.width}
                  height={item.frame.height}
                  fit="contain"
                />
              );
            }
            return (
              <RoundedRect
                key={`${item.blockId}:${itemIndex}`}
                x={item.frame.x}
                y={item.frame.y}
                width={item.frame.width}
                height={item.frame.height}
                r={18}
                color={theme.imagePlaceholder}
              />
            );
          }

          const measured = pagination.paragraphs.get(item.paragraphKey);
          if (!measured) {
            return null;
          }

          return (
            <Group key={`${item.blockId}:${item.source.startOffset}`}>
              {item.noteKind ? (
                <Rect
                  x={item.frame.x - 10}
                  y={item.frame.y}
                  width={2}
                  height={item.frame.height}
                  color={theme.noteAccent}
                />
              ) : null}
              <Group clip={item.frame}>
                <Paragraph
                  paragraph={measured.handle}
                  x={item.frame.x}
                  y={item.frame.y - item.sourceTop}
                  width={item.frame.width}
                />
              </Group>
            </Group>
          );
        })}
        {decoration ? (
          <Group
            clip={
              decorationClipWidth !== undefined &&
              decorationClipHeight !== undefined
                ? {
                    x: 0,
                    y: 0,
                    width: decorationClipWidth,
                    height: decorationClipHeight,
                  }
                : undefined
            }
          >
            <SkiaPageDecorationLayer
              decoration={decoration}
              display={progressDisplay}
              offsetX={decorationOffsetX}
              presentation={progressPresentation}
            />
          </Group>
        ) : null}
      </Group>
    </Group>
  );
}
