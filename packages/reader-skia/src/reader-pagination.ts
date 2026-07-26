import type { BookIR } from "@persimmon/book-core";
import { type PaginationResult } from "@persimmon/layout";
import type { SkParagraph } from "@shopify/react-native-skia";
import { Platform } from "react-native";

import { afterSkiaPaint } from "./skia-lifecycle";
import { releaseSkiaResources } from "./skia-resource-release";

export { createReaderLayoutSpec } from "./reader-layout-spec";

export function bookForSection(book: BookIR, sectionIndex: number): BookIR {
  return {
    schemaVersion: book.schemaVersion,
    id: book.id,
    revisionId: book.revisionId,
    title: book.title,
    ...(book.language ? { language: book.language } : {}),
    sections: [book.sections[sectionIndex]!],
    assets: book.assets,
    ...(book.coverAssetId ? { coverAssetId: book.coverAssetId } : {}),
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
