import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookLocator, SectionIR } from "@persimmon/book-core";
import { EPUB_COMPILER_VERSION } from "@persimmon/epub-import";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  bookFromManifest,
  legacyLibraryFromSerialized,
  manifestFromImport,
  normalizeSettings,
  sha256Hex,
  summaryFromManifest,
} from "./shared";
import { readingProgressFromStored, sameBookLocator } from "./reading-progress";
import {
  LibraryError,
  type BookSource,
  type ImportBookInput,
  type LibraryBookSummary,
  type LibraryRepository,
  type OpenedLibraryBook,
  type ReaderSettings,
  type SaveProgressOptions,
  type StoredBookManifest,
} from "./types";
import { compileEpubInWorker } from "./web-epub-compiler";

const DATABASE_NAME = "persimmon-library";
const LEGACY_LIBRARY_KEY = "@persimmon/library/v1";
const LEGACY_MIGRATION_KEY = "legacy-v1-migrated";
const READER_SETTINGS_KEY = "reader-settings";

interface StoredBookRecord extends StoredBookManifest {
  readonly originalEpub: Uint8Array;
}

interface StoredSectionRecord {
  readonly bookId: string;
  readonly sectionId: string;
  readonly section: SectionIR;
}

interface StoredResourceRecord {
  readonly bookId: string;
  readonly assetId: string;
  readonly bytes: Uint8Array;
}

interface StoredSetting {
  readonly key: string;
  readonly value: unknown;
}

interface StoredReadingProgress {
  readonly bookId: string;
  readonly locator: BookLocator;
  readonly publicationProgress: number;
  readonly updatedAt: string;
}

interface PersimmonDatabase extends DBSchema {
  books: {
    key: string;
    value: StoredBookRecord;
  };
  sections: {
    key: [string, string];
    value: StoredSectionRecord;
  };
  resources: {
    key: [string, string];
    value: StoredResourceRecord;
  };
  progress: {
    key: string;
    value: BookLocator | StoredReadingProgress;
  };
  settings: {
    key: string;
    value: StoredSetting;
  };
}

function storageRange(bookId: string): IDBKeyRange {
  return IDBKeyRange.bound([bookId, ""], [bookId, "\uffff"]);
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

class IndexedDbBookSource implements BookSource {
  constructor(
    private readonly database: IDBPDatabase<PersimmonDatabase>,
    readonly manifest: StoredBookManifest,
  ) {}

  async getSection(sectionId: string): Promise<SectionIR | undefined> {
    return (await this.database.get("sections", [this.manifest.id, sectionId]))
      ?.section;
  }

  async getResource(assetId: string): Promise<Uint8Array | undefined> {
    return (await this.database.get("resources", [this.manifest.id, assetId]))
      ?.bytes;
  }

  async getOriginalEpub(): Promise<Uint8Array | undefined> {
    return (await this.database.get("books", this.manifest.id))?.originalEpub;
  }
}

class IndexedDbLibraryRepository implements LibraryRepository {
  private database?: IDBPDatabase<PersimmonDatabase>;

  async initialize(): Promise<void> {
    if (this.database) {
      return;
    }
    this.database = await openDB<PersimmonDatabase>(DATABASE_NAME, 1, {
      upgrade(database) {
        database.createObjectStore("books", { keyPath: "id" });
        database.createObjectStore("sections", {
          keyPath: ["bookId", "sectionId"],
        });
        database.createObjectStore("resources", {
          keyPath: ["bookId", "assetId"],
        });
        database.createObjectStore("progress", { keyPath: "bookId" });
        database.createObjectStore("settings", { keyPath: "key" });
      },
    });
    await this.migrateLegacyLibrary();
  }

  async listBooks(): Promise<readonly LibraryBookSummary[]> {
    const database = this.requireDatabase();
    const [records, locators] = await Promise.all([
      database.getAll("books"),
      database.getAll("progress"),
    ]);
    const progressByBook = new Map(
      locators.map((progress) => [
        "locator" in progress ? progress.locator.bookId : progress.bookId,
        progress,
      ]),
    );
    const summaries = records
      .map((record) =>
        summaryFromManifest(
          record,
          readingProgressFromStored(
            progressByBook.get(record.id),
            record.sectionIds,
          ),
        ),
      )
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
    return summaries;
  }

  async importBook(input: ImportBookInput): Promise<LibraryBookSummary> {
    return this.persistImportedBook(
      input,
      input.addedAt ?? new Date().toISOString(),
    );
  }

  private async persistImportedBook(
    input: ImportBookInput,
    addedAt: string,
  ): Promise<LibraryBookSummary> {
    const database = this.requireDatabase();
    const contentDigest = await sha256Hex(input.bytes);
    const bookId = `epub:${contentDigest}`;
    const existing = await database.get("books", bookId);
    if (
      existing?.status === "ready" &&
      existing.compilerVersion === EPUB_COMPILER_VERSION
    ) {
      const progress = readingProgressFromStored(
        await database.get("progress", existing.id),
        existing.sectionIds,
      );
      return summaryFromManifest(existing, progress);
    }
    const result = await compileEpubInWorker(input.bytes, contentDigest);

    const manifest = manifestFromImport(
      result,
      input.fileName,
      addedAt,
      input.bytes.byteLength,
    );
    const record: StoredBookRecord = {
      ...manifest,
      originalEpub: input.bytes,
    };
    const transaction = database.transaction(
      ["books", "sections", "resources"],
      "readwrite",
    );

    try {
      await Promise.all([
        transaction.objectStore("sections").delete(storageRange(record.id)),
        transaction.objectStore("resources").delete(storageRange(record.id)),
      ]);
      await transaction.objectStore("books").put(record);
      for (const section of result.book.sections) {
        await transaction.objectStore("sections").put({
          bookId: record.id,
          sectionId: section.id,
          section,
        });
      }
      for (const [assetId, bytes] of Object.entries(result.resources)) {
        await transaction.objectStore("resources").put({
          bookId: record.id,
          assetId,
          bytes,
        });
      }
      await transaction.done;
    } catch (error) {
      transaction.abort();
      if (isQuotaError(error)) {
        throw new LibraryError(
          "storage-full",
          "浏览器本地空间不足，无法保存这本书。",
          { cause: error },
        );
      }
      throw error;
    }

    return summaryFromManifest(manifest);
  }

  async openBook(bookId: string): Promise<OpenedLibraryBook> {
    const database = this.requireDatabase();
    let record = await database.get("books", bookId);
    if (!record) {
      throw new LibraryError("book-not-found", "书籍不存在或已被删除。");
    }
    if (record.status === "needs-reimport") {
      throw new LibraryError(
        "needs-reimport",
        "这本书来自旧版存储，需要重新导入原 EPUB。",
      );
    }
    if (record.compilerVersion !== EPUB_COMPILER_VERSION) {
      if (record.originalEpub.byteLength === 0) {
        throw new LibraryError(
          "needs-reimport",
          "这本书缺少原 EPUB，需要重新导入后才能升级。",
        );
      }
      await this.persistImportedBook(
        {
          bytes: record.originalEpub,
          fileName: record.sourceName,
        },
        record.addedAt,
      );
      record = await database.get("books", bookId);
      if (!record) {
        throw new LibraryError("corrupt-storage", "书籍升级失败，请重新导入。");
      }
    }

    const source = new IndexedDbBookSource(database, record);
    const sections = await Promise.all(
      record.sectionIds.map((sectionId) => source.getSection(sectionId)),
    );
    if (sections.some((section) => !section)) {
      throw new LibraryError(
        "corrupt-storage",
        "书籍章节数据不完整，请删除后重新导入。",
      );
    }
    return {
      book: bookFromManifest(record, sections as SectionIR[]),
      source,
    };
  }

  async saveProgress(
    locator: BookLocator,
    options?: SaveProgressOptions,
  ): Promise<void> {
    const database = this.requireDatabase();
    const sectionIds =
      (await database.get("books", locator.bookId))?.sectionIds ?? [];
    const existing = readingProgressFromStored(
      await database.get("progress", locator.bookId),
      sectionIds,
    );
    const fallback = readingProgressFromStored(locator, sectionIds);
    const requested =
      options?.publicationProgress === undefined
        ? undefined
        : readingProgressFromStored(
            {
              locator,
              publicationProgress: options.publicationProgress,
            },
            sectionIds,
          )?.publicationProgress;
    const publicationProgress =
      requested ??
      (existing && sameBookLocator(existing.locator, locator)
        ? existing.publicationProgress
        : undefined) ??
      fallback?.publicationProgress ??
      existing?.publicationProgress ??
      0;
    await database.put("progress", {
      bookId: locator.bookId,
      locator,
      publicationProgress,
      updatedAt: options?.updatedAt ?? new Date().toISOString(),
    });
  }

  async getOriginalEpub(bookId: string): Promise<Uint8Array | undefined> {
    return (await this.requireDatabase().get("books", bookId))?.originalEpub;
  }

  async getResource(
    bookId: string,
    assetId: string,
  ): Promise<Uint8Array | undefined> {
    return (await this.requireDatabase().get("resources", [bookId, assetId]))
      ?.bytes;
  }

  async removeBook(bookId: string): Promise<void> {
    const database = this.requireDatabase();
    const transaction = database.transaction(
      ["books", "sections", "resources", "progress"],
      "readwrite",
    );
    await Promise.all([
      transaction.objectStore("books").delete(bookId),
      transaction.objectStore("sections").delete(storageRange(bookId)),
      transaction.objectStore("resources").delete(storageRange(bookId)),
      transaction.objectStore("progress").delete(bookId),
    ]);
    await transaction.done;
  }

  async getSettings(): Promise<ReaderSettings> {
    const stored = await this.requireDatabase().get(
      "settings",
      READER_SETTINGS_KEY,
    );
    return normalizeSettings(stored?.value);
  }

  async saveSettings(settings: ReaderSettings): Promise<void> {
    await this.requireDatabase().put("settings", {
      key: READER_SETTINGS_KEY,
      value: normalizeSettings(settings),
    });
  }

  async clearAllData(): Promise<void> {
    const database = this.requireDatabase();
    const transaction = database.transaction(
      ["books", "sections", "resources", "progress", "settings"],
      "readwrite",
    );
    const settingsStore = transaction.objectStore("settings");
    await Promise.all([
      transaction.objectStore("books").clear(),
      transaction.objectStore("sections").clear(),
      transaction.objectStore("resources").clear(),
      transaction.objectStore("progress").clear(),
      settingsStore.clear(),
      settingsStore.put({ key: LEGACY_MIGRATION_KEY, value: true }),
    ]);
    await transaction.done;
    await AsyncStorage.removeItem(LEGACY_LIBRARY_KEY);
  }

  private requireDatabase(): IDBPDatabase<PersimmonDatabase> {
    if (!this.database) {
      throw new Error("LibraryRepository.initialize() must be called first");
    }
    return this.database;
  }

  private async migrateLegacyLibrary(): Promise<void> {
    const database = this.requireDatabase();
    const migration = await database.get("settings", LEGACY_MIGRATION_KEY);
    if (migration?.value === true) {
      return;
    }

    const legacy = legacyLibraryFromSerialized(
      await AsyncStorage.getItem(LEGACY_LIBRARY_KEY),
    );
    const transaction = database.transaction(
      ["books", "progress", "settings"],
      "readwrite",
    );
    for (const manifest of legacy.imported) {
      const record: StoredBookRecord = {
        ...manifest,
        originalEpub: new Uint8Array(),
      };
      if (!(await transaction.objectStore("books").get(record.id))) {
        await transaction.objectStore("books").put(record);
      }
    }
    await transaction.objectStore("settings").put({
      key: LEGACY_MIGRATION_KEY,
      value: true,
    });
    await transaction.done;
  }
}

export const libraryRepository: LibraryRepository =
  new IndexedDbLibraryRepository();

export type {
  BookSource,
  ImportBookInput,
  LibraryBookSummary,
  LibraryRepository,
  OpenedLibraryBook,
  ReaderSettings,
} from "./types";
