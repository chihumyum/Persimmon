import type { BookLocator } from "@persimmon/book-core";

import type { LibraryBookSummary, LibraryRepository } from "../library/types";
import { compareClocks, latestClock, observeClock, tickClock } from "./clock";
import { mergeDeviceDocuments } from "./merge";
import {
  type CloudDeviceDocument,
  type CloudSyncRepository,
  type DeviceSyncDocument,
  type LocalSyncState,
  type SyncBookMutation,
  type SyncBookUpsert,
  type SyncProgressMutation,
  type SyncResult,
} from "./types";

function locatorKey(locator: BookLocator): string {
  return JSON.stringify(locator);
}

function revisionDigest(revisionId: string): string | undefined {
  const match = /^epub-revision:([a-f0-9]{64})$/.exec(revisionId);
  return match?.[1];
}

function newestOwnDocument(
  documents: readonly CloudDeviceDocument[],
  deviceId: string,
): CloudDeviceDocument | undefined {
  return documents
    .filter((entry) => entry.document.deviceId === deviceId)
    .sort(
      (left, right) =>
        right.document.generation - left.document.generation ||
        right.fileId.localeCompare(left.fileId),
    )[0];
}

function documentsEqual(
  left: DeviceSyncDocument,
  right: DeviceSyncDocument,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deviceDocumentFromLocalState(
  state: LocalSyncState,
): DeviceSyncDocument {
  return {
    schemaVersion: state.schemaVersion,
    deviceId: state.deviceId,
    generation: state.generation,
    books: state.books,
    progress: state.progress,
  };
}

export interface SyncStateStore {
  load(): Promise<LocalSyncState>;
  save(state: LocalSyncState): Promise<void>;
}

export class SyncEngine {
  private state?: LocalSyncState;
  private initialized = false;

  constructor(
    private readonly library: LibraryRepository,
    private readonly stateStore: SyncStateStore,
    private readonly digestBytes: (bytes: Uint8Array) => Promise<string>,
    private readonly now: () => number = Date.now,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.state = await this.stateStore.load();
    await this.reconcileRepository();
    this.initialized = true;
  }

  async noteBookImported(entry: LibraryBookSummary): Promise<void> {
    this.assertInitialized();
    if (entry.builtIn || entry.status !== "ready") {
      return;
    }
    this.recordBookUpsert(entry, this.now());
    await this.persist();
  }

  async noteBookDeleted(bookId: string): Promise<void> {
    const state = this.requireState();
    const clock = this.nextClock(this.now());
    const books = {
      ...state.books,
      [bookId]: { kind: "delete", bookId, clock } satisfies SyncBookMutation,
    };
    const knownBooks = { ...state.knownBooks };
    const knownProgress = { ...state.knownProgress };
    delete knownBooks[bookId];
    delete knownProgress[bookId];
    this.state = {
      ...state,
      generation: state.generation + 1,
      lastClock: clock,
      books,
      knownBooks,
      knownProgress,
    };
    await this.persist();
  }

  async noteProgress(locator: BookLocator): Promise<void> {
    const state = this.requireState();
    if (!state.knownBooks[locator.bookId]) {
      return;
    }
    const known = state.knownProgress[locator.bookId]?.locator;
    if (known && locatorKey(known) === locatorKey(locator)) {
      return;
    }
    const clock = this.nextClock(this.now());
    this.state = {
      ...state,
      generation: state.generation + 1,
      lastClock: clock,
      progress: {
        ...state.progress,
        [locator.bookId]: { clock, locator },
      },
      knownProgress: {
        ...state.knownProgress,
        [locator.bookId]: { locator },
      },
    };
    await this.persist();
  }

  async sync(cloud: CloudSyncRepository): Promise<SyncResult> {
    this.assertInitialized();
    await this.reconcileRepository();

    const snapshot = await cloud.loadSnapshot();
    this.mergeOwnRemoteDocuments(
      snapshot.deviceDocuments
        .filter(
          (entry) => entry.document.deviceId === this.requireState().deviceId,
        )
        .map((entry) => entry.document),
    );

    let localEntries = await this.localEntries();
    const preview = mergeDeviceDocuments([
      ...snapshot.deviceDocuments.map((entry) => entry.document),
      deviceDocumentFromLocalState(this.requireState()),
    ]);

    for (const entry of localEntries.values()) {
      if (!preview.books[entry.id]) {
        this.recordBookUpsert(entry, this.now());
      }
      if (entry.locator && !preview.progress[entry.id]) {
        this.recordProgress(entry.locator, this.now());
      }
    }

    const publishPreview = mergeDeviceDocuments([
      ...snapshot.deviceDocuments.map((entry) => entry.document),
      deviceDocumentFromLocalState(this.requireState()),
    ]);
    let uploadedBooks = 0;
    for (const mutation of Object.values(this.requireState().books)) {
      if (mutation.kind !== "upsert") {
        continue;
      }
      const winner = publishPreview.books[mutation.bookId];
      if (
        winner?.kind !== "upsert" ||
        compareClocks(winner.clock, mutation.clock) !== 0
      ) {
        continue;
      }
      const local = localEntries.get(mutation.bookId);
      if (!local || local.revisionId !== mutation.revisionId) {
        continue;
      }
      const bytes = await this.library.getOriginalEpub(mutation.bookId);
      if (!bytes || bytes.byteLength !== mutation.byteLength) {
        throw new Error(`本地 EPUB 文件不完整：${mutation.title}`);
      }
      if (
        await cloud.ensureBook(mutation.revisionId, bytes, mutation.byteLength)
      ) {
        uploadedBooks += 1;
      }
    }

    const ownRemote = newestOwnDocument(
      snapshot.deviceDocuments,
      this.requireState().deviceId,
    );
    const localDocument = deviceDocumentFromLocalState(this.requireState());
    let stateFileId = ownRemote?.fileId;
    if (!ownRemote || !documentsEqual(ownRemote.document, localDocument)) {
      stateFileId = await cloud.saveDeviceDocument(
        localDocument,
        ownRemote?.fileId,
      );
    }

    const merged = mergeDeviceDocuments([
      ...snapshot.deviceDocuments
        .filter((entry) => entry.document.deviceId !== localDocument.deviceId)
        .map((entry) => entry.document),
      localDocument,
    ]);
    if (merged.latestClock) {
      this.observe(merged.latestClock);
    }

    let downloadedBooks = 0;
    let removedBooks = 0;
    for (const [bookId, mutation] of Object.entries(merged.books)) {
      const local = localEntries.get(bookId);
      if (mutation.kind === "delete") {
        if (local) {
          await this.library.removeBook(bookId);
          localEntries.delete(bookId);
          removedBooks += 1;
        }
        this.markRemoteBookDeleted(bookId);
        continue;
      }

      if (!local || local.revisionId !== mutation.revisionId) {
        const bytes = await cloud.downloadBook(
          mutation.revisionId,
          mutation.byteLength,
        );
        const expectedDigest = revisionDigest(mutation.revisionId);
        if (
          !expectedDigest ||
          (await this.digestBytes(bytes)) !== expectedDigest
        ) {
          throw new Error(`云端 EPUB 校验失败：${mutation.title}`);
        }
        const imported = await this.library.importBook({
          bytes,
          fileName: mutation.fileName,
          addedAt: mutation.addedAt,
        });
        if (
          imported.id !== mutation.bookId ||
          imported.revisionId !== mutation.revisionId
        ) {
          throw new Error(`云端 EPUB 身份校验失败：${mutation.title}`);
        }
        localEntries.set(imported.id, imported);
        downloadedBooks += 1;
      }
      this.markRemoteBookPresent(mutation);
    }

    localEntries = await this.localEntries();
    let updatedProgress = 0;
    for (const [bookId, mutation] of Object.entries(merged.progress)) {
      const bookMutation = merged.books[bookId];
      const local = localEntries.get(bookId);
      if (
        !local ||
        bookMutation?.kind === "delete" ||
        mutation.locator.revisionId !== local.revisionId
      ) {
        continue;
      }
      if (
        !local.locator ||
        locatorKey(local.locator) !== locatorKey(mutation.locator)
      ) {
        await this.library.saveProgress(mutation.locator);
        updatedProgress += 1;
      }
      this.markRemoteProgress(mutation);
    }

    const completedAt = new Date(this.now()).toISOString();
    const state = this.requireState();
    this.state = {
      ...state,
      accounts: {
        ...state.accounts,
        [snapshot.account.id]: {
          ...(stateFileId ? { stateFileId } : {}),
          uploadedGeneration: state.generation,
          lastSuccessfulSyncAt: completedAt,
        },
      },
    };
    await this.persist();

    return {
      account: snapshot.account,
      uploadedBooks,
      downloadedBooks,
      removedBooks,
      updatedProgress,
      completedAt,
    };
  }

  private async reconcileRepository(): Promise<void> {
    const state = this.requireState();
    const entries = await this.localEntries();
    for (const entry of entries.values()) {
      if (state.knownBooks[entry.id]?.revisionId !== entry.revisionId) {
        const addedAt = Date.parse(entry.addedAt);
        this.recordBookUpsert(
          entry,
          Number.isFinite(addedAt) ? Math.min(addedAt, this.now()) : this.now(),
        );
      }
      const knownLocator = this.requireState().knownProgress[entry.id]?.locator;
      if (
        entry.locator &&
        (!knownLocator ||
          locatorKey(knownLocator) !== locatorKey(entry.locator))
      ) {
        this.recordProgress(entry.locator, this.now());
      }
    }

    for (const bookId of Object.keys(this.requireState().knownBooks)) {
      if (!entries.has(bookId)) {
        await this.noteBookDeleted(bookId);
      }
    }
    await this.persist();
  }

  private async localEntries(): Promise<Map<string, LibraryBookSummary>> {
    const entries = await this.library.listBooks();
    return new Map(
      entries
        .filter((entry) => !entry.builtIn && entry.status === "ready")
        .map((entry) => [entry.id, entry]),
    );
  }

  private recordBookUpsert(entry: LibraryBookSummary, wallTime: number): void {
    const state = this.requireState();
    const clock = this.nextClock(wallTime);
    const mutation: SyncBookUpsert = {
      kind: "upsert",
      clock,
      bookId: entry.id,
      revisionId: entry.revisionId,
      fileName: entry.sourceName,
      title: entry.title,
      ...(entry.author ? { author: entry.author } : {}),
      addedAt: entry.addedAt,
      byteLength: entry.originalByteLength,
    };
    this.state = {
      ...state,
      generation: state.generation + 1,
      lastClock: clock,
      books: { ...state.books, [entry.id]: mutation },
      knownBooks: {
        ...state.knownBooks,
        [entry.id]: { revisionId: entry.revisionId },
      },
    };
  }

  private recordProgress(locator: BookLocator, wallTime: number): void {
    const state = this.requireState();
    const clock = this.nextClock(wallTime);
    this.state = {
      ...state,
      generation: state.generation + 1,
      lastClock: clock,
      progress: {
        ...state.progress,
        [locator.bookId]: { clock, locator },
      },
      knownProgress: {
        ...state.knownProgress,
        [locator.bookId]: { locator },
      },
    };
  }

  private mergeOwnRemoteDocuments(
    documents: readonly DeviceSyncDocument[],
  ): void {
    for (const remote of documents) {
      this.mergeOwnRemoteDocument(remote);
    }
  }

  private mergeOwnRemoteDocument(remote: DeviceSyncDocument): void {
    const state = this.requireState();
    const books = { ...state.books };
    const progress = { ...state.progress };
    let changed = false;

    for (const [bookId, mutation] of Object.entries(remote.books)) {
      const local = books[bookId];
      if (!local || compareClocks(mutation.clock, local.clock) > 0) {
        books[bookId] = mutation;
        changed = true;
      }
    }
    for (const [bookId, mutation] of Object.entries(remote.progress)) {
      const local = progress[bookId];
      if (!local || compareClocks(mutation.clock, local.clock) > 0) {
        progress[bookId] = mutation;
        changed = true;
      }
    }
    const clocks = [
      ...Object.values(remote.books).map((mutation) => mutation.clock),
      ...Object.values(remote.progress).map((mutation) => mutation.clock),
    ];
    const observed = latestClock(clocks);
    this.state = {
      ...state,
      books,
      progress,
      generation:
        Math.max(state.generation, remote.generation) + (changed ? 1 : 0),
      ...(observed
        ? {
            lastClock: observeClock(
              state.lastClock,
              observed,
              state.deviceId,
              this.now(),
            ),
          }
        : {}),
    };
  }

  private markRemoteBookPresent(mutation: SyncBookUpsert): void {
    const state = this.requireState();
    this.state = {
      ...state,
      knownBooks: {
        ...state.knownBooks,
        [mutation.bookId]: { revisionId: mutation.revisionId },
      },
    };
  }

  private markRemoteBookDeleted(bookId: string): void {
    const state = this.requireState();
    const knownBooks = { ...state.knownBooks };
    const knownProgress = { ...state.knownProgress };
    delete knownBooks[bookId];
    delete knownProgress[bookId];
    this.state = { ...state, knownBooks, knownProgress };
  }

  private markRemoteProgress(mutation: SyncProgressMutation): void {
    const state = this.requireState();
    this.state = {
      ...state,
      knownProgress: {
        ...state.knownProgress,
        [mutation.locator.bookId]: { locator: mutation.locator },
      },
    };
  }

  private nextClock(wallTime: number) {
    const state = this.requireState();
    return tickClock(state.lastClock, state.deviceId, wallTime);
  }

  private observe(clock: SyncBookMutation["clock"]): void {
    const state = this.requireState();
    this.state = {
      ...state,
      lastClock: observeClock(
        state.lastClock,
        clock,
        state.deviceId,
        this.now(),
      ),
    };
  }

  private async persist(): Promise<void> {
    await this.stateStore.save(this.requireState());
  }

  private requireState(): LocalSyncState {
    if (!this.state) {
      throw new Error("SyncEngine.initialize() must be called first");
    }
    return this.state;
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error("SyncEngine.initialize() must be called first");
    }
  }
}
