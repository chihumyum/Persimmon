import type { PaginationResult } from "@persimmon/layout";
import type { SkParagraph } from "@shopify/react-native-skia";
import { Platform } from "react-native";

import { afterSkiaPaint } from "./skia-lifecycle";
import { releaseRetiredSkiaResources } from "./skia-resource-release";
import { retireLazySkiaParagraph } from "./skia-paragraph-backend";

export { createReaderLayoutSpec } from "./reader-layout-spec";

function releasePaginationAfterPaint(
  pagination: PaginationResult<SkParagraph>,
  release: (paragraph: SkParagraph) => void,
): void {
  const eagerParagraphs: SkParagraph[] = [];
  for (const paragraph of pagination.paragraphs.values()) {
    if (!retireLazySkiaParagraph(paragraph)) {
      eagerParagraphs.push(paragraph.handle);
    }
  }
  if (eagerParagraphs.length === 0) {
    return;
  }
  afterSkiaPaint(() => {
    for (const paragraph of eagerParagraphs) {
      release(paragraph);
    }
  });
}

export function disposePaginationAfterPaint(
  pagination: PaginationResult<SkParagraph>,
): void {
  for (const paragraph of pagination.paragraphs.values()) {
    retireLazySkiaParagraph(paragraph);
  }
}

export function retirePaginationAfterPaint(
  pagination: PaginationResult<SkParagraph>,
): void {
  releasePaginationAfterPaint(pagination, (paragraph) => {
    releaseRetiredSkiaResources(Platform.OS, paragraph);
  });
}
