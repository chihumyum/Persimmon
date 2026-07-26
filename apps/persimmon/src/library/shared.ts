import { CryptoDigestAlgorithm, digest } from "expo-crypto";

import {
  validateBookIR,
  type BookIR,
  type BookLocator,
  type SectionIR,
} from "@persimmon/book-core";
import {
  EPUB_COMPILER_VERSION,
  type EpubImportResult,
} from "@persimmon/epub-import";

import { DEMO_BOOK } from "../demo-book";
import {
  LIBRARY_SCHEMA_VERSION,
  type LibraryBookSummary,
  type StoredBookManifest,
} from "./types";

export { normalizeSettings } from "./reader-settings";

export interface LegacyLibraryMigration {
  readonly demoLocator?: BookLocator;
  readonly imported: readonly StoredBookManifest[];
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = Uint8Array.from(bytes);
  const result = new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, digestInput),
  );
  return [...result]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function manifestFromImport(
  result: EpubImportResult,
  sourceName: string,
  addedAt: string,
  originalByteLength: number,
): StoredBookManifest {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    compilerVersion: EPUB_COMPILER_VERSION,
    id: result.book.id,
    revisionId: result.book.revisionId,
    title: result.book.title,
    ...(result.book.language ? { language: result.book.language } : {}),
    ...(result.metadata.author ? { author: result.metadata.author } : {}),
    sourceName,
    addedAt,
    assets: result.book.assets,
    ...(result.book.coverAssetId
      ? { coverAssetId: result.book.coverAssetId }
      : {}),
    ...(result.book.navigation ? { navigation: result.book.navigation } : {}),
    sectionIds: result.book.sections.map((section) => section.id),
    metadata: result.metadata,
    warnings: result.warnings,
    status: "ready",
    originalByteLength,
  };
}

export function bookFromManifest(
  manifest: StoredBookManifest,
  sections: readonly SectionIR[],
): BookIR {
  return {
    schemaVersion: 1,
    id: manifest.id,
    revisionId: manifest.revisionId,
    title: manifest.title,
    ...(manifest.language ? { language: manifest.language } : {}),
    sections,
    assets: manifest.assets,
    ...(manifest.coverAssetId ? { coverAssetId: manifest.coverAssetId } : {}),
    ...(manifest.navigation ? { navigation: manifest.navigation } : {}),
  };
}

export function summaryFromManifest(
  manifest: StoredBookManifest,
  locator?: BookLocator,
): LibraryBookSummary {
  return {
    id: manifest.id,
    revisionId: manifest.revisionId,
    title: manifest.title,
    ...(manifest.author ? { author: manifest.author } : {}),
    sourceName: manifest.sourceName,
    addedAt: manifest.addedAt,
    originalByteLength: manifest.originalByteLength,
    ...(manifest.coverAssetId
      ? {
          coverAssetId: manifest.coverAssetId,
          ...(manifest.assets[manifest.coverAssetId]?.mediaType
            ? {
                coverMediaType:
                  manifest.assets[manifest.coverAssetId].mediaType,
              }
            : {}),
        }
      : {}),
    ...(locator ? { locator } : {}),
    status: manifest.status,
    warningCount: manifest.warnings.length,
  };
}

export function legacyLibraryFromSerialized(
  value: string | null,
): LegacyLibraryMigration {
  if (!value) {
    return { imported: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { imported: [] };
  }
  if (!Array.isArray(parsed)) {
    return { imported: [] };
  }

  let demoLocator: BookLocator | undefined;
  const imported: StoredBookManifest[] = [];
  for (const value of parsed) {
    if (typeof value !== "object" || value === null || !("book" in value)) {
      continue;
    }
    const candidate = value as {
      book?: BookIR;
      author?: unknown;
      sourceName?: unknown;
      addedAt?: unknown;
      locator?: BookLocator;
    };
    if (!candidate.book || validateBookIR(candidate.book).length > 0) {
      continue;
    }
    if (candidate.book.id === DEMO_BOOK.id) {
      if (
        candidate.locator?.bookId === DEMO_BOOK.id &&
        candidate.locator.revisionId === DEMO_BOOK.revisionId
      ) {
        demoLocator = candidate.locator;
      }
      continue;
    }

    imported.push({
      schemaVersion: LIBRARY_SCHEMA_VERSION,
      compilerVersion: 0,
      id: candidate.book.id,
      revisionId: candidate.book.revisionId,
      title: candidate.book.title,
      ...(candidate.book.language ? { language: candidate.book.language } : {}),
      ...(typeof candidate.author === "string"
        ? { author: candidate.author }
        : {}),
      sourceName:
        typeof candidate.sourceName === "string"
          ? candidate.sourceName
          : "旧版导入",
      addedAt:
        typeof candidate.addedAt === "string"
          ? candidate.addedAt
          : new Date(0).toISOString(),
      assets: {},
      sectionIds: [],
      metadata: {},
      warnings: [],
      status: "needs-reimport",
      originalByteLength: 0,
    });
  }
  return {
    ...(demoLocator ? { demoLocator } : {}),
    imported,
  };
}
