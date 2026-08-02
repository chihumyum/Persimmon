import type {
  BookIR,
  BookFontFamilyIR,
  BookLocator,
  BookNavigationItem,
  ImageAssetIR,
  SectionIR,
} from "@persimmon/book-core";
import type {
  EpubImportMetadata,
  EpubImportWarning,
} from "@persimmon/epub-import";
import {
  DEFAULT_READER_FONT_SETTINGS,
  type ReaderFontSettings,
} from "@persimmon/font-core";
import type {
  ReaderColorMode,
  ReaderPageTurnAnimation,
  ReaderThemeName,
} from "@persimmon/reader-skia";

export type {
  ReaderColorMode,
  ReaderPageTurnAnimation,
  ReaderThemeName,
} from "@persimmon/reader-skia";
export type { ReaderFontSettings } from "@persimmon/font-core";

export const LIBRARY_SCHEMA_VERSION = 2 as const;

export type LibraryBookStatus = "ready" | "needs-reimport";

export interface LibraryBookSummary {
  readonly id: string;
  readonly revisionId: string;
  readonly title: string;
  readonly author?: string;
  readonly sourceName: string;
  readonly addedAt: string;
  readonly originalByteLength: number;
  readonly builtIn?: boolean;
  readonly coverAssetId?: string;
  readonly coverMediaType?: string;
  readonly locator?: BookLocator;
  readonly readingProgress?: number;
  readonly lastReadAt?: string;
  readonly status: LibraryBookStatus;
  readonly warningCount: number;
}

export interface LibraryReadingProgress {
  readonly locator: BookLocator;
  /**
   * Denormalized local display value. The stable locator remains the
   * cross-device progress authority because pagination varies by device.
   */
  readonly publicationProgress: number;
  readonly updatedAt?: string;
}

export interface SaveProgressOptions {
  readonly publicationProgress?: number;
  readonly updatedAt?: string;
}

export interface StoredBookManifest {
  readonly schemaVersion: typeof LIBRARY_SCHEMA_VERSION;
  readonly compilerVersion: number;
  readonly id: string;
  readonly revisionId: string;
  readonly title: string;
  readonly language?: string;
  readonly author?: string;
  readonly sourceName: string;
  readonly addedAt: string;
  readonly assets: Readonly<Record<string, ImageAssetIR>>;
  readonly fontFamilies?: Readonly<Record<string, BookFontFamilyIR>>;
  readonly coverAssetId?: string;
  readonly navigation?: readonly BookNavigationItem[];
  readonly sectionIds: readonly string[];
  readonly metadata: EpubImportMetadata;
  readonly warnings: readonly EpubImportWarning[];
  readonly status: LibraryBookStatus;
  readonly originalByteLength: number;
}

export interface ReaderSettings {
  readonly appearance: ReaderAppearanceSettings;
  readonly layout: "single" | "spread";
  readonly pageTurnAnimation: ReaderPageTurnAnimation;
  readonly pageTurnTuning: ReaderPageTurnTuning;
}

export type ReaderProgressDisplay = "footer" | "header" | "both" | "hidden";

export interface ReaderAppearanceSettings {
  readonly theme: ReaderThemeName;
  readonly colorMode: ReaderColorMode;
  readonly font: ReaderFontSettings;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly paragraphSpacing: number;
  readonly horizontalMargin: number;
  readonly progressDisplay: ReaderProgressDisplay;
}

export interface ReaderPageTurnTuning {
  readonly gesture: ReaderGesturePageTurnTuning;
}

export interface ReaderGesturePageTurnTuning {
  readonly releaseX: number;
  readonly liftVelocity: number;
  readonly liftToLeft: number;
  readonly curvatureRelaxation: number;
  readonly pageWeight: number;
  readonly commitThreshold: number;
  readonly minimumSpeedScale: number;
  readonly maximumSpeedScale: number;
  readonly velocityGain: number;
  readonly idleDecaySeconds: number;
}

export const DEFAULT_READER_GESTURE_PAGE_TURN_TUNING: ReaderGesturePageTurnTuning =
  {
    releaseX: 0.69,
    liftVelocity: 0.9,
    liftToLeft: 1.65,
    curvatureRelaxation: 7,
    pageWeight: 0.6,
    commitThreshold: 0.53,
    minimumSpeedScale: 0.95,
    maximumSpeedScale: 2,
    velocityGain: 0.6,
    idleDecaySeconds: 0.09,
  };

export const DEFAULT_READER_PAGE_TURN_TUNING: ReaderPageTurnTuning = {
  gesture: DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
};

export const DEFAULT_READER_APPEARANCE: ReaderAppearanceSettings = {
  theme: "warm",
  colorMode: "system",
  font: DEFAULT_READER_FONT_SETTINGS,
  fontSize: 20,
  lineHeight: 1.65,
  paragraphSpacing: 0.9,
  horizontalMargin: 32,
  progressDisplay: "footer",
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  appearance: DEFAULT_READER_APPEARANCE,
  layout: "single",
  pageTurnAnimation: "natural",
  pageTurnTuning: DEFAULT_READER_PAGE_TURN_TUNING,
};

export interface BookSource {
  readonly manifest: StoredBookManifest;
  getSection(sectionId: string): Promise<SectionIR | undefined>;
  getResource(assetId: string): Promise<Uint8Array | undefined>;
  getOriginalEpub(): Promise<Uint8Array | undefined>;
}

export interface OpenedLibraryBook {
  readonly book: BookIR;
  readonly source: BookSource;
}

export interface ImportBookInput {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly addedAt?: string;
}

export interface LibraryRepository {
  initialize(): Promise<void>;
  listBooks(): Promise<readonly LibraryBookSummary[]>;
  importBook(input: ImportBookInput): Promise<LibraryBookSummary>;
  openBook(bookId: string): Promise<OpenedLibraryBook>;
  getOriginalEpub(bookId: string): Promise<Uint8Array | undefined>;
  getResource(bookId: string, assetId: string): Promise<Uint8Array | undefined>;
  saveProgress(
    locator: BookLocator,
    options?: SaveProgressOptions,
  ): Promise<void>;
  removeBook(bookId: string): Promise<void>;
  getSettings(): Promise<ReaderSettings>;
  saveSettings(settings: ReaderSettings): Promise<void>;
}

export type LibraryErrorCode =
  | "book-not-found"
  | "needs-reimport"
  | "corrupt-storage"
  | "storage-full";

export class LibraryError extends Error {
  readonly code: LibraryErrorCode;

  constructor(code: LibraryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LibraryError";
    this.code = code;
  }
}
