import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookLocator, SectionIR } from "@persimmon/book-core";
import { EPUB_COMPILER_VERSION } from "@persimmon/epub-import";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { DEMO_BOOK } from "../demo-book";
import { demoSummary, openDemoBook } from "./demo";
import {
  bookFromManifest,
  legacyLibraryFromSerialized,
  manifestFromImport,
  normalizeSettings,
  sha256Hex,
  summaryFromManifest,
} from "./shared";
import {
  LibraryError,
  type BookSource,
  type ImportBookInput,
  type LibraryBookSummary,
  type LibraryRepository,
  type OpenedLibraryBook,
  type ReaderSettings,
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
    value: BookLocator;
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
    const locatorByBook = new Map(
      locators.map((locator) => [locator.bookId, locator]),
    );
    const summaries = records
      .map((record) =>
        summaryFromManifest(record, locatorByBook.get(record.id)),
      )
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
    return [
      demoSummary(locatorByBook.get(DEMO_BOOK.id)),
      ...summaries.filter((summary) => summary.id !== DEMO_BOOK.id),
    ];
  }

  async importBook(input: ImportBookInput): Promise<LibraryBookSummary> {
    const database = this.requireDatabase();
    const contentDigest = await sha256Hex(input.bytes);
    const result = await compileEpubInWorker(input.bytes, contentDigest);
    const existing = await database.get("books", result.book.id);
    if (
      existing?.status === "ready" &&
      existing.compilerVersion === EPUB_COMPILER_VERSION
    ) {
      const locator = await database.get("progress", existing.id);
      return summaryFromManifest(existing, locator);
    }

    const manifest = manifestFromImport(
      result,
      input.fileName,
      new Date().toISOString(),
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
    if (bookId === DEMO_BOOK.id) {
      return openDemoBook();
    }

    const database = this.requireDatabase();
    const record = await database.get("books", bookId);
    if (!record) {
      throw new LibraryError("book-not-found", "书籍不存在或已被删除。");
    }
    if (record.status === "needs-reimport") {
      throw new LibraryError(
        "needs-reimport",
        "这本书来自旧版存储，需要重新导入原 EPUB。",
      );
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

  async saveProgress(locator: BookLocator): Promise<void> {
    await this.requireDatabase().put("progress", locator);
  }

  async getResource(
    bookId: string,
    assetId: string,
  ): Promise<Uint8Array | undefined> {
    if (bookId === DEMO_BOOK.id) {
      return undefined;
    }
    return (await this.requireDatabase().get("resources", [bookId, assetId]))
      ?.bytes;
  }

  async removeBook(bookId: string): Promise<void> {
    if (bookId === DEMO_BOOK.id) {
      return;
    }
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
    if (legacy.demoLocator) {
      await transaction.objectStore("progress").put(legacy.demoLocator);
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
