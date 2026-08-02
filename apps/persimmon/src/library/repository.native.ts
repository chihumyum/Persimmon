import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookLocator, SectionIR } from "@persimmon/book-core";
import { EPUB_COMPILER_VERSION, importEpub } from "@persimmon/epub-import";
import { Directory, File, Paths } from "expo-file-system";

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
  LIBRARY_SCHEMA_VERSION,
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
import {
  NATIVE_SECTION_SNAPSHOT_FILE,
  parseNativeSectionSnapshot,
  serializeNativeSectionSnapshot,
} from "./native-section-snapshot";

const LEGACY_LIBRARY_KEY = "@persimmon/library/v1";
const LEGACY_MIGRATION_KEY = "@persimmon/library/v2/legacy-migrated";
const INDEX_KEY = "@persimmon/library/v2/index";
const READER_SETTINGS_KEY = "@persimmon/library/v2/reader-settings";
const PROGRESS_PREFIX = "@persimmon/library/v2/progress/";
const MINIMUM_FREE_SPACE = 10 * 1024 * 1024;
const REPLACEMENT_BACKUP_SUFFIX = ".replacement-backup";

function progressKey(bookId: string): string {
  return `${PROGRESS_PREFIX}${bookId}`;
}

function storageName(identifier: string): string {
  return encodeURIComponent(identifier);
}

function sectionFileName(index: number): string {
  return `${index.toString().padStart(6, "0")}.json`;
}

function isStoredBookManifest(value: unknown): value is StoredBookManifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<StoredBookManifest>;
  return (
    candidate.schemaVersion === LIBRARY_SCHEMA_VERSION &&
    typeof candidate.compilerVersion === "number" &&
    typeof candidate.id === "string" &&
    typeof candidate.revisionId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.sourceName === "string" &&
    typeof candidate.addedAt === "string" &&
    typeof candidate.assets === "object" &&
    Array.isArray(candidate.sectionIds) &&
    Array.isArray(candidate.warnings) &&
    (candidate.status === "ready" || candidate.status === "needs-reimport") &&
    typeof candidate.originalByteLength === "number"
  );
}

function parseManifest(serialized: string): StoredBookManifest | undefined {
  try {
    const value: unknown = JSON.parse(serialized);
    return isStoredBookManifest(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

class NativeBookSource implements BookSource {
  private readonly sectionIndexById: ReadonlyMap<string, number>;
  private sectionSnapshotPromise?: Promise<readonly SectionIR[] | undefined>;

  constructor(
    private readonly directory: Directory,
    readonly manifest: StoredBookManifest,
  ) {
    this.sectionIndexById = new Map(
      manifest.sectionIds.map((sectionId, index) => [sectionId, index]),
    );
  }

  async getSection(sectionId: string): Promise<SectionIR | undefined> {
    const index = this.sectionIndexById.get(sectionId);
    if (index === undefined) {
      return undefined;
    }
    const snapshot = await this.getSectionSnapshot();
    if (snapshot) {
      return snapshot[index];
    }
    const file = new File(this.directory, "sections", sectionFileName(index));
    if (!file.exists) {
      return undefined;
    }
    try {
      return JSON.parse(await file.text()) as SectionIR;
    } catch {
      return undefined;
    }
  }

  async getSections(): Promise<readonly SectionIR[] | undefined> {
    const snapshot = await this.getSectionSnapshot();
    if (snapshot) {
      return snapshot;
    }
    const sections = await Promise.all(
      this.manifest.sectionIds.map((sectionId) => this.getSection(sectionId)),
    );
    return sections.some((section) => !section)
      ? undefined
      : (sections as SectionIR[]);
  }

  async hasValidSectionSnapshot(): Promise<boolean> {
    return (await this.getSectionSnapshot()) !== undefined;
  }

  private getSectionSnapshot(): Promise<readonly SectionIR[] | undefined> {
    this.sectionSnapshotPromise ??= (async () => {
      const file = new File(this.directory, NATIVE_SECTION_SNAPSHOT_FILE);
      if (!file.exists) {
        return undefined;
      }
      return parseNativeSectionSnapshot(
        await file.text(),
        this.manifest.sectionIds,
      );
    })();
    return this.sectionSnapshotPromise;
  }

  async getResource(assetId: string): Promise<Uint8Array | undefined> {
    const file = new File(
      this.directory,
      "resources",
      `${storageName(assetId)}.bin`,
    );
    return file.exists ? file.bytes() : undefined;
  }

  async getOriginalEpub(): Promise<Uint8Array | undefined> {
    const file = new File(this.directory, "original.epub");
    return file.exists ? file.bytes() : undefined;
  }
}

class NativeLibraryRepository implements LibraryRepository {
  private readonly root = new Directory(Paths.document, "persimmon-library-v2");
  private readonly booksDirectory = new Directory(this.root, "books");
  private readonly stagingDirectory = new Directory(this.root, "staging");
  private readonly manifests = new Map<string, StoredBookManifest>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.root.create({ idempotent: true, intermediates: true });
    this.booksDirectory.create({ idempotent: true });
    this.stagingDirectory.create({ idempotent: true });
    await this.recoverInterruptedReplacements();
    this.cleanStagingDirectory();
    await this.migrateLegacyLibrary();
    await this.rebuildIndex();
    this.initialized = true;
  }

  async listBooks(): Promise<readonly LibraryBookSummary[]> {
    this.assertInitialized();
    const manifests = [...this.manifests.values()];
    const progressValues = await AsyncStorage.multiGet(
      manifests.map((manifest) => progressKey(manifest.id)),
    );
    const progressByBook = new Map<string, unknown>();
    for (const [key, value] of progressValues) {
      if (!value) {
        continue;
      }
      try {
        progressByBook.set(
          key.slice(PROGRESS_PREFIX.length),
          JSON.parse(value) as unknown,
        );
      } catch {
        // A corrupt progress record is disposable; book content is untouched.
      }
    }

    return manifests
      .map((manifest) =>
        summaryFromManifest(
          manifest,
          readingProgressFromStored(
            progressByBook.get(manifest.id),
            manifest.sectionIds,
          ),
        ),
      )
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
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
    this.assertInitialized();
    const estimatedRequiredSpace =
      input.bytes.byteLength * 3 + MINIMUM_FREE_SPACE;
    if (Paths.availableDiskSpace < estimatedRequiredSpace) {
      throw new LibraryError(
        "storage-full",
        "设备可用空间不足，无法安全导入这本书。",
      );
    }

    const contentDigest = await sha256Hex(input.bytes);
    const bookId = `epub:${contentDigest}`;
    const existing = this.manifests.get(bookId);
    if (
      existing?.status === "ready" &&
      existing.compilerVersion === EPUB_COMPILER_VERSION
    ) {
      const progress = await this.readProgress(existing);
      return summaryFromManifest(existing, progress);
    }

    const result = importEpub(input.bytes, { contentDigest });

    const manifest = manifestFromImport(
      result,
      input.fileName,
      addedAt,
      input.bytes.byteLength,
    );
    const stage = new Directory(
      this.stagingDirectory,
      `${storageName(manifest.id)}-${Date.now()}`,
    );
    stage.create();

    try {
      const resources = new Directory(stage, "resources");
      resources.create();

      new File(stage, "original.epub").write(input.bytes);
      new File(stage, NATIVE_SECTION_SNAPSHOT_FILE).write(
        serializeNativeSectionSnapshot(result.book.sections),
      );
      for (const [assetId, bytes] of Object.entries(result.resources)) {
        new File(resources, `${storageName(assetId)}.bin`).write(bytes);
      }
      new File(stage, "manifest.json").write(JSON.stringify(manifest));
      this.validateStagedBook(stage, manifest);

      await this.replaceBookDirectory(stage, manifest.id);
      this.manifests.set(manifest.id, manifest);
      await this.persistIndex();
      return summaryFromManifest(manifest);
    } catch (error) {
      if (stage.exists) {
        stage.delete();
      }
      throw error;
    }
  }

  async openBook(bookId: string): Promise<OpenedLibraryBook> {
    this.assertInitialized();
    let manifest = this.manifests.get(bookId);
    if (!manifest) {
      throw new LibraryError("book-not-found", "书籍不存在或已被删除。");
    }
    if (manifest.status === "needs-reimport") {
      throw new LibraryError(
        "needs-reimport",
        "这本书来自旧版存储，需要重新导入原 EPUB。",
      );
    }
    if (manifest.compilerVersion !== EPUB_COMPILER_VERSION) {
      const original = await new NativeBookSource(
        this.bookDirectory(bookId),
        manifest,
      ).getOriginalEpub();
      if (!original || original.byteLength === 0) {
        throw new LibraryError(
          "needs-reimport",
          "这本书缺少原 EPUB，需要重新导入后才能升级。",
        );
      }
      await this.persistImportedBook(
        {
          bytes: original,
          fileName: manifest.sourceName,
        },
        manifest.addedAt,
      );
      manifest = this.manifests.get(bookId);
      if (!manifest) {
        throw new LibraryError("corrupt-storage", "书籍升级失败，请重新导入。");
      }
    }

    const source = new NativeBookSource(this.bookDirectory(bookId), manifest);
    const sections = await source.getSections();
    if (!sections) {
      throw new LibraryError(
        "corrupt-storage",
        "书籍章节数据不完整，请删除后重新导入。",
      );
    }
    if (!(await source.hasValidSectionSnapshot())) {
      try {
        new File(
          this.bookDirectory(bookId),
          NATIVE_SECTION_SNAPSHOT_FILE,
        ).write(serializeNativeSectionSnapshot(sections));
      } catch {
        // The legacy per-section files remain authoritative if cache migration
        // cannot be persisted, for example when the device is low on space.
      }
    }
    return {
      book: bookFromManifest(manifest, sections),
      source,
    };
  }

  async saveProgress(
    locator: BookLocator,
    options?: SaveProgressOptions,
  ): Promise<void> {
    this.assertInitialized();
    const sectionIds = this.manifests.get(locator.bookId)?.sectionIds ?? [];
    const existingValue = await AsyncStorage.getItem(
      progressKey(locator.bookId),
    );
    let parsedExisting: unknown;
    try {
      parsedExisting = existingValue
        ? (JSON.parse(existingValue) as unknown)
        : undefined;
    } catch {
      parsedExisting = undefined;
    }
    const existing = readingProgressFromStored(parsedExisting, sectionIds);
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
    await AsyncStorage.setItem(
      progressKey(locator.bookId),
      JSON.stringify({
        locator,
        publicationProgress:
          requested ??
          (existing && sameBookLocator(existing.locator, locator)
            ? existing.publicationProgress
            : undefined) ??
          fallback?.publicationProgress ??
          existing?.publicationProgress ??
          0,
        updatedAt: options?.updatedAt ?? new Date().toISOString(),
      }),
    );
  }

  async getOriginalEpub(bookId: string): Promise<Uint8Array | undefined> {
    this.assertInitialized();
    const file = new File(this.bookDirectory(bookId), "original.epub");
    return file.exists ? file.bytes() : undefined;
  }

  async getResource(
    bookId: string,
    assetId: string,
  ): Promise<Uint8Array | undefined> {
    this.assertInitialized();
    const file = new File(
      this.bookDirectory(bookId),
      "resources",
      `${storageName(assetId)}.bin`,
    );
    return file.exists ? file.bytes() : undefined;
  }

  async removeBook(bookId: string): Promise<void> {
    this.assertInitialized();
    const directory = this.bookDirectory(bookId);
    if (directory.exists) {
      directory.delete();
    }
    this.manifests.delete(bookId);
    await Promise.all([
      AsyncStorage.removeItem(progressKey(bookId)),
      this.persistIndex(),
    ]);
  }

  async getSettings(): Promise<ReaderSettings> {
    this.assertInitialized();
    const serialized = await AsyncStorage.getItem(READER_SETTINGS_KEY);
    if (!serialized) {
      return normalizeSettings(undefined);
    }
    try {
      return normalizeSettings(JSON.parse(serialized));
    } catch {
      return normalizeSettings(undefined);
    }
  }

  async saveSettings(settings: ReaderSettings): Promise<void> {
    this.assertInitialized();
    await AsyncStorage.setItem(
      READER_SETTINGS_KEY,
      JSON.stringify(normalizeSettings(settings)),
    );
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error("LibraryRepository.initialize() must be called first");
    }
  }

  private bookDirectory(bookId: string): Directory {
    return new Directory(this.booksDirectory, storageName(bookId));
  }

  private replacementBackupDirectory(bookId: string): Directory {
    return new Directory(
      this.booksDirectory,
      `${storageName(bookId)}${REPLACEMENT_BACKUP_SUFFIX}`,
    );
  }

  /**
   * Same-volume directory renames keep either the old or new complete book.
   * Startup recovery handles the two possible interruption points.
   */
  private async replaceBookDirectory(
    staged: Directory,
    bookId: string,
  ): Promise<void> {
    const destination = this.bookDirectory(bookId);
    const backup = this.replacementBackupDirectory(bookId);
    if (backup.exists) {
      backup.delete();
    }
    if (destination.exists) {
      await destination.move(backup);
    }
    const finalDestination = this.bookDirectory(bookId);
    try {
      await staged.move(finalDestination);
      if (backup.exists) {
        backup.delete();
      }
    } catch (error) {
      if (!finalDestination.exists && backup.exists) {
        await backup.move(finalDestination);
      }
      throw error;
    }
  }

  private async recoverInterruptedReplacements(): Promise<void> {
    for (const entry of this.booksDirectory.list()) {
      if (
        !(entry instanceof Directory) ||
        !entry.uri.match(/\.replacement-backup\/?$/)
      ) {
        continue;
      }
      const manifestFile = new File(entry, "manifest.json");
      const manifest = manifestFile.exists
        ? parseManifest(await manifestFile.text())
        : undefined;
      if (!manifest) {
        entry.delete();
        continue;
      }
      const destination = this.bookDirectory(manifest.id);
      if (destination.exists) {
        entry.delete();
      } else {
        await entry.move(destination);
      }
    }
  }

  private cleanStagingDirectory(): void {
    for (const entry of this.stagingDirectory.list()) {
      entry.delete();
    }
  }

  private validateStagedBook(
    directory: Directory,
    expected: StoredBookManifest,
  ): void {
    const manifestFile = new File(directory, "manifest.json");
    const original = new File(directory, "original.epub");
    const stored = manifestFile.exists
      ? parseManifest(manifestFile.textSync())
      : undefined;
    if (
      !stored ||
      stored.id !== expected.id ||
      !original.exists ||
      original.size !== expected.originalByteLength
    ) {
      throw new LibraryError(
        "corrupt-storage",
        "暂存书籍校验失败，导入已取消。",
      );
    }

    const sectionSnapshot = new File(directory, NATIVE_SECTION_SNAPSHOT_FILE);
    const storedSections = sectionSnapshot.exists
      ? parseNativeSectionSnapshot(
          sectionSnapshot.textSync(),
          expected.sectionIds,
        )
      : undefined;
    if (!storedSections) {
      throw new LibraryError(
        "corrupt-storage",
        "暂存书籍缺少章节，导入已取消。",
      );
    }
    const requiredResourceIds = [
      ...Object.keys(expected.assets),
      ...Object.values(expected.fontFamilies ?? {}).flatMap((family) =>
        family.faces.map((face) => face.resourceId),
      ),
    ];
    for (const assetId of requiredResourceIds) {
      if (
        !new File(directory, "resources", `${storageName(assetId)}.bin`).exists
      ) {
        throw new LibraryError(
          "corrupt-storage",
          "暂存书籍缺少内容资源，导入已取消。",
        );
      }
    }
  }

  private async rebuildIndex(): Promise<void> {
    this.manifests.clear();
    for (const entry of this.booksDirectory.list()) {
      if (!(entry instanceof Directory)) {
        continue;
      }
      const manifestFile = new File(entry, "manifest.json");
      if (!manifestFile.exists) {
        continue;
      }
      const manifest = parseManifest(await manifestFile.text());
      if (manifest) {
        this.manifests.set(manifest.id, manifest);
      }
    }
    await this.persistIndex();
  }

  private async persistIndex(): Promise<void> {
    await AsyncStorage.setItem(
      INDEX_KEY,
      JSON.stringify(
        [...this.manifests.values()].map((manifest) =>
          summaryFromManifest(manifest),
        ),
      ),
    );
  }

  private async readProgress(
    manifest: StoredBookManifest,
  ): Promise<ReturnType<typeof readingProgressFromStored>> {
    const serialized = await AsyncStorage.getItem(progressKey(manifest.id));
    if (!serialized) {
      return undefined;
    }
    try {
      return readingProgressFromStored(
        JSON.parse(serialized) as unknown,
        manifest.sectionIds,
      );
    } catch {
      return undefined;
    }
  }

  private async migrateLegacyLibrary(): Promise<void> {
    if ((await AsyncStorage.getItem(LEGACY_MIGRATION_KEY)) === "true") {
      return;
    }
    const migration = legacyLibraryFromSerialized(
      await AsyncStorage.getItem(LEGACY_LIBRARY_KEY),
    );
    for (const manifest of migration.imported) {
      const directory = this.bookDirectory(manifest.id);
      if (!directory.exists) {
        directory.create();
        new File(directory, "manifest.json").write(JSON.stringify(manifest));
      }
    }
    await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
  }
}

export const libraryRepository: LibraryRepository =
  new NativeLibraryRepository();

export type {
  BookSource,
  ImportBookInput,
  LibraryBookSummary,
  LibraryRepository,
  OpenedLibraryBook,
  ReaderSettings,
} from "./types";
