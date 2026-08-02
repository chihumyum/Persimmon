export const FONT_REPOSITORY_SCHEMA_VERSION = 1 as const;
export const FONT_CATALOG_SCHEMA_VERSION = 1 as const;

export const BUILTIN_READER_SERIF_ID = "builtin:noto-serif-sc";
export const BUILTIN_READER_SANS_ID = "builtin:noto-sans-sc";
export const BUILTIN_READER_MATH_ID = "builtin:noto-sans-math";

export type FontSource = "bundled" | "downloaded" | "user";
export type FontCategory = "serif" | "sans" | "mono" | "display" | "unknown";
export type FontFaceStyle = "normal" | "italic";
export type FontFileFormat = "ttf" | "otf";

export interface FontLicense {
  readonly name: string;
  readonly url?: string;
  readonly redistributable: boolean;
}

export interface FontCoverage {
  readonly latin: boolean;
  readonly cjk: boolean;
  readonly math: boolean;
  readonly emoji: boolean;
}

export interface FontFaceRecord {
  readonly id: string;
  readonly familyId: string;
  readonly postscriptName?: string;
  readonly weight: number;
  readonly style: FontFaceStyle;
  readonly format: FontFileFormat;
  readonly sha256?: string;
  readonly byteLength: number;
  readonly storageKey?: string;
  readonly coverage: FontCoverage;
  readonly variable: boolean;
  readonly embeddingRestrictions?: number;
}

export interface FontFamilyRecord {
  readonly id: string;
  readonly displayName: string;
  readonly source: FontSource;
  readonly category: FontCategory;
  readonly faces: readonly FontFaceRecord[];
  readonly license?: FontLicense;
}

export interface FontRepositorySnapshot {
  readonly schemaVersion: typeof FONT_REPOSITORY_SCHEMA_VERSION;
  readonly families: readonly FontFamilyRecord[];
}

export interface DownloadableFontFace {
  readonly id: string;
  readonly weight: number;
  readonly style: FontFaceStyle;
  readonly format: FontFileFormat;
  readonly url: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface DownloadableFontFamily {
  readonly id: string;
  readonly displayName: string;
  readonly category: FontCategory;
  readonly description?: string;
  readonly license: FontLicense;
  readonly faces: readonly DownloadableFontFace[];
}

export interface DownloadableFontCatalog {
  readonly schemaVersion: typeof FONT_CATALOG_SCHEMA_VERSION;
  readonly families: readonly DownloadableFontFamily[];
}

export interface ReaderFontSettings {
  readonly selectedFontId: string;
  readonly useBookEmbeddedFonts: boolean;
}

export const DEFAULT_READER_FONT_SETTINGS: ReaderFontSettings = {
  selectedFontId: BUILTIN_READER_SERIF_ID,
  useBookEmbeddedFonts: true,
};

export function normalizeFontWeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 400;
  }
  return Math.min(900, Math.max(100, Math.round(value / 100) * 100));
}

export function normalizeReaderFontSettings(
  value: unknown,
  legacyFamily?: unknown,
): ReaderFontSettings {
  if (typeof value !== "object" || value === null) {
    return {
      selectedFontId:
        legacyFamily === "sans"
          ? BUILTIN_READER_SANS_ID
          : BUILTIN_READER_SERIF_ID,
      useBookEmbeddedFonts: DEFAULT_READER_FONT_SETTINGS.useBookEmbeddedFonts,
    };
  }
  const candidate = value as Partial<ReaderFontSettings>;
  return {
    selectedFontId:
      typeof candidate.selectedFontId === "string" &&
      candidate.selectedFontId.trim().length > 0
        ? candidate.selectedFontId
        : legacyFamily === "sans"
          ? BUILTIN_READER_SANS_ID
          : BUILTIN_READER_SERIF_ID,
    useBookEmbeddedFonts:
      typeof candidate.useBookEmbeddedFonts === "boolean"
        ? candidate.useBookEmbeddedFonts
        : DEFAULT_READER_FONT_SETTINGS.useBookEmbeddedFonts,
  };
}

export function resolveAvailableFontId(
  requestedId: string,
  families: readonly FontFamilyRecord[],
): string {
  return families.some((family) => family.id === requestedId)
    ? requestedId
    : BUILTIN_READER_SERIF_ID;
}
