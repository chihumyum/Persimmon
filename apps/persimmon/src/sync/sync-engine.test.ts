import type { BookLocator } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_READER_SETTINGS,
  type ImportBookInput,
  type LibraryBookSummary,
  type LibraryRepository,
  type OpenedLibraryBook,
  type ReaderSettings,
  type SaveProgressOptions,
} from "../library/types";
import { SyncEngine } from "./sync-engine";
import {
  SYNC_SCHEMA_VERSION,
  type CloudSyncRepository,
  type CloudSyncSnapshot,
  type DeviceSyncDocument,
  type LocalSyncState,
} from "./types";

const ABC_DIGEST =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const BOOK_ID = `epub:${ABC_DIGEST}`;
const REVISION_ID = `epub-revision:${ABC_DIGEST}`;
const EPUB_BYTES = new TextEncoder().encode("abc");

function summary(locator?: BookLocator): LibraryBookSummary {
  return {
    id: BOOK_ID,
    revisionId: REVISION_ID,
    title: "Cloud Book",
    author: "Reader",
    sourceName: "cloud.epub",
    addedAt: "2026-01-01T00:00:00.000Z",
    originalByteLength: EPUB_BYTES.byteLength,
    ...(locator ? { locator } : {}),
    status: "ready",
    warningCount: 0,
  };
}

class FakeLibrary implements LibraryRepository {
  books = new Map<string, LibraryBookSummary>();
  bytes = new Map<string, Uint8Array>();

  async initialize(): Promise<void> {}

  async listBooks(): Promise<readonly LibraryBookSummary[]> {
    return [...this.books.values()];
  }

  async importBook(input: ImportBookInput): Promise<LibraryBookSummary> {
    const entry = summary();
    this.books.set(entry.id, entry);
    this.bytes.set(entry.id, input.bytes);
    return entry;
  }

  async openBook(): Promise<OpenedLibraryBook> {
    throw new Error("not used");
  }

  async getOriginalEpub(bookId: string): Promise<Uint8Array | undefined> {
    return this.bytes.get(bookId);
  }

  async getResource(): Promise<Uint8Array | undefined> {
    return undefined;
  }

  async saveProgress(
    locator: BookLocator,
    options?: SaveProgressOptions,
  ): Promise<void> {
    const entry = this.books.get(locator.bookId);
    if (entry) {
      this.books.set(locator.bookId, {
        ...entry,
        locator,
        ...(options?.publicationProgress === undefined
          ? {}
          : { readingProgress: options.publicationProgress }),
        ...(options?.updatedAt ? { lastReadAt: options.updatedAt } : {}),
      });
    }
  }

  async removeBook(bookId: string): Promise<void> {
    this.books.delete(bookId);
    this.bytes.delete(bookId);
  }

  async getSettings(): Promise<ReaderSettings> {
    return DEFAULT_READER_SETTINGS;
  }

  async saveSettings(): Promise<void> {}

  async clearAllData(): Promise<void> {
    this.books.clear();
    this.bytes.clear();
  }
}

class MemoryStateStore {
  constructor(public state: LocalSyncState) {}

  async load(): Promise<LocalSyncState> {
    return structuredClone(this.state);
  }

  async save(state: LocalSyncState): Promise<void> {
    this.state = structuredClone(state);
  }
}

class FakeCloud implements CloudSyncRepository {
  savedDocument?: DeviceSyncDocument;
  uploadedBooks = 0;

  constructor(
    readonly snapshot: CloudSyncSnapshot,
    readonly download = EPUB_BYTES,
  ) {}

  async loadSnapshot(): Promise<CloudSyncSnapshot> {
    return this.snapshot;
  }

  async ensureBook(): Promise<boolean> {
    this.uploadedBooks += 1;
    return true;
  }

  async downloadBook(): Promise<Uint8Array> {
    return this.download;
  }

  async saveDeviceDocument(document: DeviceSyncDocument): Promise<string> {
    this.savedDocument = document;
    return "local-state-file";
  }
}

function emptyLocalState(deviceId = "local-device"): LocalSyncState {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId,
    generation: 0,
    lastClock: { wallTime: 0, counter: 0, deviceId },
    knownBooks: {},
    knownProgress: {},
    books: {},
    progress: {},
    accounts: {},
  };
}

describe("SyncEngine", () => {
  it("uploads the immutable EPUB before publishing its device state", async () => {
    const library = new FakeLibrary();
    const entry = summary();
    library.books.set(entry.id, entry);
    library.bytes.set(entry.id, EPUB_BYTES);
    const store = new MemoryStateStore(emptyLocalState());
    const cloud = new FakeCloud({
      account: { id: "account" },
      deviceDocuments: [],
    });
    const engine = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => 1_000,
    );

    await engine.initialize();
    const result = await engine.sync(cloud);

    expect(result.uploadedBooks).toBe(1);
    expect(cloud.savedDocument?.books[BOOK_ID]).toMatchObject({
      kind: "upsert",
      byteLength: EPUB_BYTES.byteLength,
      revisionId: REVISION_ID,
    });
  });

  it("downloads a verified EPUB and applies the latest stable locator", async () => {
    const locator: BookLocator = {
      bookId: BOOK_ID,
      revisionId: REVISION_ID,
      position: { sectionId: "s1", blockId: "b1", offset: 42 },
    };
    const remoteDocument: DeviceSyncDocument = {
      schemaVersion: SYNC_SCHEMA_VERSION,
      deviceId: "remote-device",
      generation: 2,
      books: {
        [BOOK_ID]: {
          kind: "upsert",
          clock: {
            wallTime: 100,
            counter: 0,
            deviceId: "remote-device",
          },
          bookId: BOOK_ID,
          revisionId: REVISION_ID,
          fileName: "cloud.epub",
          title: "Cloud Book",
          author: "Reader",
          addedAt: "2026-01-01T00:00:00.000Z",
          byteLength: EPUB_BYTES.byteLength,
        },
      },
      progress: {
        [BOOK_ID]: {
          clock: {
            wallTime: 200,
            counter: 0,
            deviceId: "remote-device",
          },
          locator,
          publicationProgress: 0.73,
        },
      },
    };
    const library = new FakeLibrary();
    const store = new MemoryStateStore(emptyLocalState());
    const cloud = new FakeCloud({
      account: { id: "account", email: "reader@example.com" },
      deviceDocuments: [
        { fileId: "remote-state-file", document: remoteDocument },
      ],
    });
    const engine = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => 1_000,
    );

    await engine.initialize();
    const progressEvents: Array<{
      readonly stage: "downloading" | "finalizing";
      readonly completedBooks: number;
      readonly totalBooks: number;
      readonly currentBookTitle?: string;
    }> = [];
    const progressivelyVisibleEntries: LibraryBookSummary[] = [];
    const result = await engine.sync(cloud, {
      onProgress: (progress) => {
        progressEvents.push(progress);
      },
      onLibraryChanged: async () => {
        const [visibleEntry] = await library.listBooks();
        if (visibleEntry) {
          progressivelyVisibleEntries.push(visibleEntry);
        }
      },
    });

    expect(result.downloadedBooks).toBe(1);
    expect(result.updatedProgress).toBe(1);
    expect(progressEvents).toEqual([
      {
        stage: "downloading",
        completedBooks: 0,
        totalBooks: 1,
        currentBookTitle: "Cloud Book",
      },
      {
        stage: "finalizing",
        completedBooks: 1,
        totalBooks: 1,
      },
    ]);
    expect(progressivelyVisibleEntries).toEqual([
      expect.objectContaining({
        locator,
        readingProgress: 0.73,
      }),
    ]);
    expect((await library.listBooks())[0]).toMatchObject({
      locator,
      readingProgress: 0.73,
    });
    expect(cloud.savedDocument?.books[BOOK_ID]).toMatchObject({
      kind: "upsert",
      revisionId: REVISION_ID,
    });
    expect(cloud.savedDocument?.progress[BOOK_ID]).toMatchObject({
      locator,
      publicationProgress: 0.73,
    });
    expect(cloud.savedDocument?.books[BOOK_ID]?.clock.deviceId).toBe(
      "local-device",
    );
  });

  it("keeps progress recorded after a sync durable across restart", async () => {
    const remoteLocator: BookLocator = {
      bookId: BOOK_ID,
      revisionId: REVISION_ID,
      position: { sectionId: "s1", blockId: "remote", offset: 12 },
    };
    const activeReaderLocator: BookLocator = {
      bookId: BOOK_ID,
      revisionId: REVISION_ID,
      position: { sectionId: "s2", blockId: "local", offset: 84 },
    };
    const remoteDocument: DeviceSyncDocument = {
      schemaVersion: SYNC_SCHEMA_VERSION,
      deviceId: "remote-device",
      generation: 2,
      books: {
        [BOOK_ID]: {
          kind: "upsert",
          clock: { wallTime: 100, counter: 0, deviceId: "remote-device" },
          bookId: BOOK_ID,
          revisionId: REVISION_ID,
          fileName: "cloud.epub",
          title: "Cloud Book",
          addedAt: "2026-01-01T00:00:00.000Z",
          byteLength: EPUB_BYTES.byteLength,
        },
      },
      progress: {
        [BOOK_ID]: {
          clock: { wallTime: 200, counter: 0, deviceId: "remote-device" },
          locator: remoteLocator,
          publicationProgress: 0.2,
        },
      },
    };
    const snapshot: CloudSyncSnapshot = {
      account: { id: "account" },
      deviceDocuments: [
        { fileId: "remote-state-file", document: remoteDocument },
      ],
    };
    const library = new FakeLibrary();
    const entry = summary();
    library.books.set(entry.id, entry);
    library.bytes.set(entry.id, EPUB_BYTES);
    const store = new MemoryStateStore(emptyLocalState());
    let now = 1_000;
    const engine = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => now,
    );

    await engine.initialize();
    await engine.sync(new FakeCloud(snapshot));
    now = 2_000;
    await engine.noteProgress(
      activeReaderLocator,
      0.84,
      new Date(now).toISOString(),
    );

    expect((await library.listBooks())[0]).toMatchObject({
      locator: activeReaderLocator,
      readingProgress: 0.84,
    });

    const restarted = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => 3_000,
    );
    await restarted.initialize();
    const afterRestartCloud = new FakeCloud(snapshot);
    await restarted.sync(afterRestartCloud);

    expect((await library.listBooks())[0]).toMatchObject({
      locator: activeReaderLocator,
      readingProgress: 0.84,
    });
    expect(afterRestartCloud.savedDocument?.progress[BOOK_ID]).toMatchObject({
      locator: activeReaderLocator,
      publicationProgress: 0.84,
    });
  });

  it("recovers a locally written position when sync registration was interrupted", async () => {
    const remoteLocator: BookLocator = {
      bookId: BOOK_ID,
      revisionId: REVISION_ID,
      position: { sectionId: "s1", blockId: "remote", offset: 10 },
    };
    const activeReaderLocator: BookLocator = {
      bookId: BOOK_ID,
      revisionId: REVISION_ID,
      position: { sectionId: "s3", blockId: "local", offset: 90 },
    };
    const library = new FakeLibrary();
    library.books.set(BOOK_ID, {
      ...summary(activeReaderLocator),
      readingProgress: 0.9,
      lastReadAt: new Date(2_000).toISOString(),
    });
    library.bytes.set(BOOK_ID, EPUB_BYTES);
    const store = new MemoryStateStore({
      ...emptyLocalState(),
      generation: 2,
      lastClock: {
        wallTime: 1_000,
        counter: 0,
        deviceId: "remote-device",
      },
      knownBooks: {
        [BOOK_ID]: { revisionId: REVISION_ID },
      },
      knownProgress: {
        [BOOK_ID]: { locator: remoteLocator, publicationProgress: 0.1 },
      },
      progress: {
        [BOOK_ID]: {
          clock: {
            wallTime: 1_000,
            counter: 0,
            deviceId: "remote-device",
          },
          locator: remoteLocator,
          publicationProgress: 0.1,
        },
      },
    });
    const restarted = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => 3_000,
    );

    await restarted.initialize();

    expect(store.state.progress[BOOK_ID]).toMatchObject({
      locator: activeReaderLocator,
      publicationProgress: 0.9,
      clock: { wallTime: 2_000, deviceId: "local-device" },
    });
  });

  it("applies a newer remote tombstone without re-uploading the stale EPUB", async () => {
    const library = new FakeLibrary();
    const entry = summary();
    library.books.set(entry.id, entry);
    library.bytes.set(entry.id, EPUB_BYTES);
    const store = new MemoryStateStore(emptyLocalState());
    const remoteDocument: DeviceSyncDocument = {
      schemaVersion: SYNC_SCHEMA_VERSION,
      deviceId: "remote-device",
      generation: 1,
      books: {
        [BOOK_ID]: {
          kind: "delete",
          clock: {
            wallTime: Date.parse("2026-02-01T00:00:00.000Z"),
            counter: 0,
            deviceId: "remote-device",
          },
          bookId: BOOK_ID,
        },
      },
      progress: {},
    };
    const cloud = new FakeCloud({
      account: { id: "account" },
      deviceDocuments: [
        { fileId: "remote-state-file", document: remoteDocument },
      ],
    });
    const engine = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => Date.parse("2026-03-01T00:00:00.000Z"),
    );

    await engine.initialize();
    const result = await engine.sync(cloud);

    expect(result.removedBooks).toBe(1);
    expect(cloud.uploadedBooks).toBe(0);
    expect(await library.listBooks()).toEqual([]);
  });

  it("does not turn a present needs-reimport book into a cloud tombstone", async () => {
    const library = new FakeLibrary();
    library.books.set(BOOK_ID, {
      ...summary(),
      status: "needs-reimport",
    });
    const localState: LocalSyncState = {
      ...emptyLocalState(),
      knownBooks: {
        [BOOK_ID]: { revisionId: REVISION_ID },
      },
    };
    const store = new MemoryStateStore(localState);
    const remoteDocument: DeviceSyncDocument = {
      schemaVersion: SYNC_SCHEMA_VERSION,
      deviceId: "remote-device",
      generation: 1,
      books: {
        [BOOK_ID]: {
          kind: "upsert",
          clock: {
            wallTime: 100,
            counter: 0,
            deviceId: "remote-device",
          },
          bookId: BOOK_ID,
          revisionId: REVISION_ID,
          fileName: "cloud.epub",
          title: "Cloud Book",
          addedAt: "2026-01-01T00:00:00.000Z",
          byteLength: EPUB_BYTES.byteLength,
        },
      },
      progress: {},
    };
    const cloud = new FakeCloud({
      account: { id: "account" },
      deviceDocuments: [
        { fileId: "remote-state-file", document: remoteDocument },
      ],
    });
    const engine = new SyncEngine(
      library,
      store,
      async () => ABC_DIGEST,
      () => 1_000,
    );

    await engine.initialize();
    const result = await engine.sync(cloud);

    expect(result.downloadedBooks).toBe(1);
    expect((await library.listBooks())[0]?.status).toBe("ready");
    expect(cloud.savedDocument?.books[BOOK_ID]?.kind).toBe("upsert");
  });
});
