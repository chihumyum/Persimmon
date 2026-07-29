import type { BookLocator } from "@persimmon/book-core";

export const SYNC_SCHEMA_VERSION = 1 as const;

export interface HybridClock {
  readonly wallTime: number;
  readonly counter: number;
  readonly deviceId: string;
}

export interface SyncBookUpsert {
  readonly kind: "upsert";
  readonly clock: HybridClock;
  readonly bookId: string;
  readonly revisionId: string;
  readonly fileName: string;
  readonly title: string;
  readonly author?: string;
  readonly addedAt: string;
  readonly byteLength: number;
}

export interface SyncBookDelete {
  readonly kind: "delete";
  readonly clock: HybridClock;
  readonly bookId: string;
}

export type SyncBookMutation = SyncBookUpsert | SyncBookDelete;

export interface SyncProgressMutation {
  readonly clock: HybridClock;
  readonly locator: BookLocator;
  /**
   * Denormalized display value. The locator remains authoritative, but carrying
   * this avoids showing a stale percentage after a cross-device merge.
   */
  readonly publicationProgress?: number;
}

export interface DeviceSyncDocument {
  readonly schemaVersion: typeof SYNC_SCHEMA_VERSION;
  readonly deviceId: string;
  readonly generation: number;
  readonly books: Readonly<Record<string, SyncBookMutation>>;
  readonly progress: Readonly<Record<string, SyncProgressMutation>>;
}

export interface KnownBook {
  readonly revisionId: string;
}

export interface KnownProgress {
  readonly locator: BookLocator;
  readonly publicationProgress?: number;
}

export interface SyncAccountState {
  readonly stateFileId?: string;
  readonly uploadedGeneration?: number;
  readonly lastSuccessfulSyncAt?: string;
}

export interface LocalSyncState {
  readonly schemaVersion: typeof SYNC_SCHEMA_VERSION;
  readonly deviceId: string;
  readonly generation: number;
  readonly lastClock: HybridClock;
  readonly knownBooks: Readonly<Record<string, KnownBook>>;
  readonly knownProgress: Readonly<Record<string, KnownProgress>>;
  readonly books: Readonly<Record<string, SyncBookMutation>>;
  readonly progress: Readonly<Record<string, SyncProgressMutation>>;
  readonly accounts: Readonly<Record<string, SyncAccountState>>;
}

export interface CloudAccount {
  readonly id: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface CloudDeviceDocument {
  readonly fileId: string;
  readonly document: DeviceSyncDocument;
}

export interface CloudSyncSnapshot {
  readonly account: CloudAccount;
  readonly deviceDocuments: readonly CloudDeviceDocument[];
}

export interface CloudSyncRepository {
  loadSnapshot(): Promise<CloudSyncSnapshot>;
  ensureBook(
    revisionId: string,
    bytes: Uint8Array,
    expectedByteLength: number,
  ): Promise<boolean>;
  downloadBook(
    revisionId: string,
    expectedByteLength: number,
  ): Promise<Uint8Array>;
  saveDeviceDocument(
    document: DeviceSyncDocument,
    existingFileId?: string,
  ): Promise<string>;
}

export interface SyncResult {
  readonly account: CloudAccount;
  readonly uploadedBooks: number;
  readonly downloadedBooks: number;
  readonly removedBooks: number;
  readonly updatedProgress: number;
  readonly completedAt: string;
}

export type GoogleDriveSyncStatus =
  | { readonly phase: "loading" }
  | { readonly phase: "unconfigured"; readonly message: string }
  | { readonly phase: "disconnected" }
  | { readonly phase: "authorizing" }
  | {
      readonly phase: "syncing";
      readonly accountEmail?: string;
      readonly lastSyncedAt?: string;
    }
  | {
      readonly phase: "idle";
      readonly accountEmail?: string;
      readonly lastSyncedAt: string;
    }
  | {
      readonly phase: "reauthorization-required";
      readonly message: string;
      readonly accountEmail?: string;
      readonly lastSyncedAt?: string;
    }
  | {
      readonly phase: "error";
      readonly message: string;
      readonly accountEmail?: string;
      readonly lastSyncedAt?: string;
    };
