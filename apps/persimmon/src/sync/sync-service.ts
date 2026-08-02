import type { BookLocator } from "@persimmon/book-core";

import { translate } from "../i18n";
import { libraryRepository } from "../library/repository";
import { sha256Hex } from "../library/shared";
import type { LibraryBookSummary } from "../library/types";
import { googleDriveAuth, GoogleAuthError } from "./google-auth";
import { DriveApiError, GoogleDriveClient } from "./google-drive-client";
import { GoogleDriveCloudRepository } from "./google-drive-cloud";
import {
  googleDriveConfigurationMessage,
  isGoogleDriveConfigured,
} from "./google-drive-config";
import { LocalSyncStateStore } from "./local-state-store";
import { SyncEngine } from "./sync-engine";
import type { GoogleDriveSyncStatus } from "./types";

type StatusListener = (status: GoogleDriveSyncStatus) => void;

function userFacingSyncError(error: unknown): string {
  if (error instanceof GoogleAuthError) {
    switch (error.code) {
      case "unconfigured":
        return googleDriveConfigurationMessage();
      case "authorization-required":
        return translate("sync.errors.authorizationRequired");
      case "authorization-cancelled":
        return translate("sync.errors.authorizationCancelled");
      case "authorization-failed":
        return translate("sync.errors.authorizationFailed");
    }
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      error instanceof TypeError ||
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("无法连接")
    ) {
      return translate("sync.errors.network");
    }
  }
  return translate("sync.errors.failed");
}

class GoogleDriveSyncService {
  private readonly engine = new SyncEngine(
    libraryRepository,
    new LocalSyncStateStore(),
    sha256Hex,
  );
  private readonly listeners = new Set<StatusListener>();
  private status: GoogleDriveSyncStatus = { phase: "loading" };
  private engineInitialization?: Promise<void>;
  private serviceInitialization?: Promise<void>;
  private activeSync?: Promise<void>;
  private operationTail: Promise<void> = Promise.resolve();
  private scheduledSync?: ReturnType<typeof setTimeout>;
  private authorized = false;
  private accountEmail?: string;
  private lastSyncedAt?: string;

  getStatus(): GoogleDriveSyncStatus {
    return this.status;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  initialize(): Promise<void> {
    if (this.serviceInitialization) {
      return this.serviceInitialization;
    }
    this.serviceInitialization = this.initializeOnce();
    return this.serviceInitialization;
  }

  async connectAndSync(): Promise<void> {
    try {
      await this.ensureEngine();
      if (!isGoogleDriveConfigured()) {
        this.updateStatus({
          phase: "unconfigured",
          message: googleDriveConfigurationMessage(),
        });
        return;
      }
      this.updateStatus({ phase: "authorizing" });
      await googleDriveAuth.connect();
      this.authorized = true;
      await this.syncNow();
    } catch (error) {
      this.authorized = false;
      if (
        error instanceof GoogleAuthError &&
        error.code === "authorization-cancelled"
      ) {
        this.updateStatus({ phase: "disconnected" });
        return;
      }
      this.updateAuthOrErrorStatus(error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.scheduledSync) {
      clearTimeout(this.scheduledSync);
      this.scheduledSync = undefined;
    }
    try {
      await googleDriveAuth.disconnect();
    } catch {
      // Local sign-out still wins even if Google's revocation endpoint is down.
    } finally {
      this.authorized = false;
      this.accountEmail = undefined;
      this.lastSyncedAt = undefined;
      this.updateStatus({ phase: "disconnected" });
    }
  }

  async syncNow(): Promise<void> {
    try {
      await this.ensureEngine();
    } catch (error) {
      this.updateAuthOrErrorStatus(error);
      return;
    }
    if (!this.authorized) {
      return;
    }
    if (this.activeSync) {
      return this.activeSync;
    }
    const activeSync = this.enqueue(() => this.performSync()).finally(() => {
      if (this.activeSync === activeSync) {
        this.activeSync = undefined;
      }
    });
    this.activeSync = activeSync;
    return this.activeSync;
  }

  async noteBookImported(entry: LibraryBookSummary): Promise<void> {
    await this.ensureEngine();
    await this.enqueue(() => this.engine.noteBookImported(entry));
    this.scheduleSync();
  }

  async noteBookDeleted(bookId: string): Promise<void> {
    await this.ensureEngine();
    await this.enqueue(() => this.engine.noteBookDeleted(bookId));
    this.scheduleSync();
  }

  async noteProgress(
    locator: BookLocator,
    publicationProgress?: number,
    updatedAt?: string,
  ): Promise<void> {
    await this.ensureEngine();
    await libraryRepository.saveProgress(locator, {
      ...(publicationProgress === undefined ? {} : { publicationProgress }),
      ...(updatedAt ? { updatedAt } : {}),
    });
    await this.enqueue(() =>
      this.engine.noteProgress(locator, publicationProgress, updatedAt),
    );
    this.scheduleSync();
  }

  private async initializeOnce(): Promise<void> {
    try {
      await this.ensureEngine();
      if (!isGoogleDriveConfigured() || !googleDriveAuth.isConfigured()) {
        this.updateStatus({
          phase: "unconfigured",
          message: googleDriveConfigurationMessage(),
        });
        return;
      }
      this.authorized = await googleDriveAuth.initialize();
      if (!this.authorized) {
        this.updateStatus({ phase: "disconnected" });
        return;
      }
      await this.syncNow();
    } catch (error) {
      this.authorized = false;
      this.updateAuthOrErrorStatus(error);
    }
  }

  private ensureEngine(): Promise<void> {
    this.engineInitialization ??= this.engine.initialize();
    return this.engineInitialization;
  }

  private async performSync(): Promise<void> {
    this.updateStatus({
      phase: "syncing",
      ...(this.accountEmail ? { accountEmail: this.accountEmail } : {}),
      ...(this.lastSyncedAt ? { lastSyncedAt: this.lastSyncedAt } : {}),
    });
    try {
      const client = new GoogleDriveClient(googleDriveAuth);
      const result = await this.engine.sync(
        new GoogleDriveCloudRepository(client),
      );
      this.accountEmail = result.account.email;
      this.lastSyncedAt = result.completedAt;
      this.updateStatus({
        phase: "idle",
        ...(this.accountEmail ? { accountEmail: this.accountEmail } : {}),
        lastSyncedAt: result.completedAt,
      });
    } catch (error) {
      this.updateAuthOrErrorStatus(error);
    }
  }

  private scheduleSync(): void {
    if (!this.authorized) {
      return;
    }
    if (this.scheduledSync) {
      clearTimeout(this.scheduledSync);
    }
    this.scheduledSync = setTimeout(() => {
      this.scheduledSync = undefined;
      void this.syncNow();
    }, 1_500);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private updateAuthOrErrorStatus(error: unknown): void {
    const shared = {
      ...(this.accountEmail ? { accountEmail: this.accountEmail } : {}),
      ...(this.lastSyncedAt ? { lastSyncedAt: this.lastSyncedAt } : {}),
    };
    if (
      error instanceof GoogleAuthError ||
      (error instanceof DriveApiError && error.status === 401)
    ) {
      this.authorized = false;
      this.updateStatus({
        phase: "reauthorization-required",
        message:
          error instanceof DriveApiError
            ? translate("sync.errors.authorizationRequired")
            : userFacingSyncError(error),
        ...shared,
      });
      return;
    }
    this.updateStatus({
      phase: "error",
      message: userFacingSyncError(error),
      ...shared,
    });
  }

  private updateStatus(status: GoogleDriveSyncStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}

export const googleDriveSyncService = new GoogleDriveSyncService();
