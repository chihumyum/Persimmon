import {
  createDefaultPageLayoutSpec,
  type PageLayoutSpec,
  type PaginationResult,
} from "@persimmon/layout";
import type { SkParagraph } from "@shopify/react-native-skia";
import { Platform } from "react-native";

import { afterSkiaPaint } from "./skia-lifecycle";
import { releaseSkiaResources } from "./skia-resource-release";

export function createReaderLayoutSpec(
  width: number,
  height: number,
  fontSize: number,
): PageLayoutSpec {
  const spec = createDefaultPageLayoutSpec({ width, height });
  const scale = fontSize / spec.body.fontSize;
  return {
    ...spec,
    body: { ...spec.body, fontSize },
    note: {
      ...spec.note,
      fontSize: spec.note.fontSize * scale,
    },
    headings: {
      1: {
        ...spec.headings[1],
        fontSize: spec.headings[1].fontSize * scale,
      },
      2: {
        ...spec.headings[2],
        fontSize: spec.headings[2].fontSize * scale,
      },
      3: {
        ...spec.headings[3],
        fontSize: spec.headings[3].fontSize * scale,
      },
    },
  };
}

export function disposePaginationAfterPaint(
  pagination: PaginationResult<SkParagraph>,
): void {
  afterSkiaPaint(() => {
    for (const paragraph of pagination.paragraphs.values()) {
      releaseSkiaResources(Platform.OS, paragraph.handle, null);
    }
  });
}
