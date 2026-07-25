import type {
  BookIR,
  BookLocator,
  BookNavigationItem,
  ImageAssetIR,
  SectionIR,
} from "@persimmon/book-core";
import type {
  EpubImportMetadata,
  EpubImportWarning,
} from "@persimmon/epub-import";

export const LIBRARY_SCHEMA_VERSION = 2 as const;

export type LibraryBookStatus = "ready" | "needs-reimport";

export interface LibraryBookSummary {
  readonly id: string;
  readonly revisionId: string;
  readonly title: string;
  readonly author?: string;
  readonly sourceName: string;
  readonly addedAt: string;
  readonly builtIn?: boolean;
  readonly coverAssetId?: string;
  readonly coverMediaType?: string;
  readonly locator?: BookLocator;
  readonly status: LibraryBookStatus;
  readonly warningCount: number;
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
  readonly coverAssetId?: string;
  readonly navigation?: readonly BookNavigationItem[];
  readonly sectionIds: readonly string[];
  readonly metadata: EpubImportMetadata;
  readonly warnings: readonly EpubImportWarning[];
  readonly status: LibraryBookStatus;
  readonly originalByteLength: number;
}

export interface ReaderSettings {
  readonly fontSize: number;
  readonly layout: "single" | "spread";
  readonly pageTurnTuning: ReaderPageTurnTuning;
}

export interface ReaderPageTurnTuning {
  readonly click: ReaderClickPageTurnTuning;
  readonly gesture: ReaderGesturePageTurnTuning;
}

export interface ReaderClickPageTurnTuning {
  readonly releaseX: number;
  readonly liftVelocity: number;
  readonly liftToLeft: number;
  readonly curvatureRelaxation: number;
  readonly playbackSpeed: number;
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

export const DEFAULT_READER_CLICK_PAGE_TURN_TUNING: ReaderClickPageTurnTuning =
  {
    releaseX: 0.72,
    liftVelocity: 1.35,
    liftToLeft: 2,
    curvatureRelaxation: 7,
    playbackSpeed: 1,
  };

export const DEFAULT_READER_GESTURE_PAGE_TURN_TUNING: ReaderGesturePageTurnTuning =
  {
    releaseX: 0.72,
    liftVelocity: 1.35,
    liftToLeft: 2,
    curvatureRelaxation: 7,
    pageWeight: 1,
    commitThreshold: 0.78,
    minimumSpeedScale: 0.95,
    maximumSpeedScale: 2,
    velocityGain: 0.6,
    idleDecaySeconds: 0.09,
  };

export const DEFAULT_READER_PAGE_TURN_TUNING: ReaderPageTurnTuning = {
  click: DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
  gesture: DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 20,
  layout: "single",
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
}

export interface LibraryRepository {
  initialize(): Promise<void>;
  listBooks(): Promise<readonly LibraryBookSummary[]>;
  importBook(input: ImportBookInput): Promise<LibraryBookSummary>;
  openBook(bookId: string): Promise<OpenedLibraryBook>;
  getResource(bookId: string, assetId: string): Promise<Uint8Array | undefined>;
  saveProgress(locator: BookLocator): Promise<void>;
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
