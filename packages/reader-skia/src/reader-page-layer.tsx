import type { PageScene, PaginationResult } from "@persimmon/layout";
import {
  Group,
  Image as SkiaImage,
  Paragraph,
  RoundedRect,
  type SkParagraph,
  type Transforms3d,
} from "@shopify/react-native-skia";
import type { DerivedValue } from "react-native-reanimated";

import type { DecodedImageCache } from "./image-cache";
import type { ReaderProgressDisplay } from "./reader-appearance";
import {
  SkiaPageDecorationLayer,
  type SkiaPageDecoration,
} from "./skia-page-decoration";

interface ReaderPageLayerProps {
  readonly page: PageScene;
  readonly pagination: PaginationResult<SkParagraph>;
  readonly imageCache: DecodedImageCache;
  readonly decoration?: SkiaPageDecoration;
  readonly progressDisplay?: ReaderProgressDisplay;
  readonly offsetX?: number;
  readonly translateX?: DerivedValue<Transforms3d>;
}

export function ReaderPageLayer({
  page,
  pagination,
  imageCache,
  decoration,
  progressDisplay = "hidden",
  offsetX = 0,
  translateX,
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
                color="#eed9c8"
              />
            );
          }

          const measured = pagination.paragraphs.get(item.paragraphKey);
          if (!measured) {
            return null;
          }

          return (
            <Group
              key={`${item.blockId}:${item.source.startOffset}`}
              clip={item.frame}
            >
              <Paragraph
                paragraph={measured.handle}
                x={item.frame.x}
                y={item.frame.y - item.sourceTop}
                width={item.frame.width}
              />
            </Group>
          );
        })}
        {decoration ? (
          <SkiaPageDecorationLayer
            decoration={decoration}
            display={progressDisplay}
          />
        ) : null}
      </Group>
    </Group>
  );
}
