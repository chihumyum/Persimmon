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

function boundedPublicationProgress(
  value: number | undefined,
): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
}

function progressKey(
  locator: BookLocator,
  publicationProgress?: number,
): string {
  return JSON.stringify({
    locator,
    publicationProgress: boundedPublicationProgress(publicationProgress),
  });
}

function eventWallTime(updatedAt: string | undefined, now: number): number {
  if (!updatedAt) {
    return now;
  }
  const parsed = Date.parse(updatedAt);
  return Number.isFinite(parsed) ? Math.min(now, Math.max(0, parsed)) : now;
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
    this.recordBookDelete(bookId, this.now());
    await this.persist();
  }

  async noteProgress(
    locator: BookLocator,
    publicationProgress?: number,
    updatedAt?: string,
  ): Promise<void> {
    const state = this.requireState();
    if (!state.knownBooks[locator.bookId]) {
      return;
    }
    const normalizedProgress = boundedPublicationProgress(publicationProgress);
    const known = state.knownProgress[locator.bookId];
    if (
      known &&
      progressKey(known.locator, known.publicationProgress) ===
        progressKey(locator, normalizedProgress)
    ) {
      return;
    }
    const now = this.now();
    this.recordProgress(
      locator,
      eventWallTime(updatedAt, now),
      normalizedProgress,
    );
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
        const now = this.now();
        this.recordProgress(
          entry.locator,
          eventWallTime(entry.lastReadAt, now),
          entry.readingProgress,
        );
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

    const merged = mergeDeviceDocuments([
      ...snapshot.deviceDocuments
        .filter(
          (entry) => entry.document.deviceId !== this.requireState().deviceId,
        )
        .map((entry) => entry.document),
      deviceDocumentFromLocalState(this.requireState()),
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
        this.ensureOwnBookDeleted(bookId);
        continue;
      }

      let resolvedLocal = local;
      if (!resolvedLocal || resolvedLocal.revisionId !== mutation.revisionId) {
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
        resolvedLocal = imported;
        downloadedBooks += 1;
      }
      this.markRemoteBookPresent(mutation);
      this.ensureOwnBookPresent(resolvedLocal);
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
      const locatorChanged =
        !local.locator ||
        locatorKey(local.locator) !== locatorKey(mutation.locator);
      const displayProgressChanged =
        mutation.publicationProgress !== undefined &&
        Math.abs((local.readingProgress ?? 0) - mutation.publicationProgress) >
          0.000_001;
      if (locatorChanged || displayProgressChanged) {
        await this.library.saveProgress(mutation.locator, {
          ...(mutation.publicationProgress === undefined
            ? {}
            : { publicationProgress: mutation.publicationProgress }),
          updatedAt: new Date(mutation.clock.wallTime).toISOString(),
        });
        updatedProgress += 1;
      }
      let normalizedProgress =
        boundedPublicationProgress(mutation.publicationProgress) ??
        (locatorChanged ? undefined : local.readingProgress);
      if (normalizedProgress === undefined && locatorChanged) {
        localEntries = await this.localEntries();
        normalizedProgress = localEntries.get(bookId)?.readingProgress;
      }
      this.markRemoteProgress(mutation, normalizedProgress);
      this.ensureOwnProgress(mutation.locator, normalizedProgress);
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
    const allEntries = (await this.library.listBooks()).filter(
      (entry) => !entry.builtIn,
    );
    const presentBookIds = new Set(allEntries.map((entry) => entry.id));
    const entries = new Map(
      allEntries
        .filter((entry) => entry.status === "ready")
        .map((entry) => [entry.id, entry]),
    );
    for (const entry of entries.values()) {
      if (state.knownBooks[entry.id]?.revisionId !== entry.revisionId) {
        const addedAt = Date.parse(entry.addedAt);
        this.recordBookUpsert(
          entry,
          Number.isFinite(addedAt) ? Math.min(addedAt, this.now()) : this.now(),
        );
      }
      const knownProgress = this.requireState().knownProgress[entry.id];
      if (
        entry.locator &&
        (!knownProgress ||
          progressKey(
            knownProgress.locator,
            knownProgress.publicationProgress,
          ) !== progressKey(entry.locator, entry.readingProgress))
      ) {
        const now = this.now();
        this.recordProgress(
          entry.locator,
          eventWallTime(entry.lastReadAt, now),
          entry.readingProgress,
        );
      }
    }

    for (const bookId of Object.keys(this.requireState().knownBooks)) {
      if (!presentBookIds.has(bookId)) {
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

  private recordProgress(
    locator: BookLocator,
    wallTime: number,
    publicationProgress?: number,
  ): void {
    const state = this.requireState();
    const clock = this.nextClock(wallTime);
    const normalizedProgress = boundedPublicationProgress(publicationProgress);
    this.state = {
      ...state,
      generation: state.generation + 1,
      lastClock: clock,
      progress: {
        ...state.progress,
        [locator.bookId]: {
          clock,
          locator,
          ...(normalizedProgress === undefined
            ? {}
            : { publicationProgress: normalizedProgress }),
        },
      },
      knownProgress: {
        ...state.knownProgress,
        [locator.bookId]: {
          locator,
          ...(normalizedProgress === undefined
            ? {}
            : { publicationProgress: normalizedProgress }),
        },
      },
    };
  }

  private recordBookDelete(bookId: string, wallTime: number): void {
    const state = this.requireState();
    const clock = this.nextClock(wallTime);
    const knownBooks = { ...state.knownBooks };
    const knownProgress = { ...state.knownProgress };
    delete knownBooks[bookId];
    delete knownProgress[bookId];
    this.state = {
      ...state,
      generation: state.generation + 1,
      lastClock: clock,
      books: {
        ...state.books,
        [bookId]: { kind: "delete", bookId, clock },
      },
      knownBooks,
      knownProgress,
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

  private ensureOwnBookDeleted(bookId: string): void {
    if (this.requireState().books[bookId]?.kind !== "delete") {
      this.recordBookDelete(bookId, this.now());
    }
  }

  private ensureOwnBookPresent(entry: LibraryBookSummary): void {
    const mutation = this.requireState().books[entry.id];
    if (
      mutation?.kind !== "upsert" ||
      mutation.revisionId !== entry.revisionId
    ) {
      this.recordBookUpsert(entry, this.now());
    }
  }

  private ensureOwnProgress(
    locator: BookLocator,
    publicationProgress?: number,
  ): void {
    const mutation = this.requireState().progress[locator.bookId];
    if (
      !mutation ||
      progressKey(mutation.locator, mutation.publicationProgress) !==
        progressKey(locator, publicationProgress)
    ) {
      this.recordProgress(locator, this.now(), publicationProgress);
    }
  }

  private markRemoteProgress(
    mutation: SyncProgressMutation,
    publicationProgress?: number,
  ): void {
    const state = this.requireState();
    const normalizedProgress = boundedPublicationProgress(publicationProgress);
    this.state = {
      ...state,
      knownProgress: {
        ...state.knownProgress,
        [mutation.locator.bookId]: {
          locator: mutation.locator,
          ...(normalizedProgress === undefined
            ? {}
            : { publicationProgress: normalizedProgress }),
        },
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
