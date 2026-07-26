import type { PaginationResult } from "@persimmon/layout";
import type { SkParagraph } from "@shopify/react-native-skia";
import { Platform } from "react-native";

import { afterSkiaPaint } from "./skia-lifecycle";
import { releaseSkiaResources } from "./skia-resource-release";

export { createReaderLayoutSpec } from "./reader-layout-spec";

export function disposePaginationAfterPaint(
  pagination: PaginationResult<SkParagraph>,
): void {
  afterSkiaPaint(() => {
    for (const paragraph of pagination.paragraphs.values()) {
      releaseSkiaResources(Platform.OS, paragraph.handle, null);
    }
  });
}
