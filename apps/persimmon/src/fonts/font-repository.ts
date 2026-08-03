import {
  FONT_REPOSITORY_SCHEMA_VERSION,
  type FontRepositorySnapshot,
} from "@persimmon/font-core";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  allFontFamilies,
  mergeInstalledFamily,
  parseStoredFontSnapshot,
  prepareFontInstall,
} from "./font-repository-shared";
import {
  FontRepositoryError,
  type FontRepository,
  type InstallFontInput,
} from "./types";

const DATABASE_NAME = "persimmon-fonts-v1";
const SNAPSHOT_KEY = "repository";

interface StoredMetadata {
  readonly key: string;
  readonly value: unknown;
}

interface StoredFontFile {
  readonly storageKey: string;
  readonly bytes: Uint8Array;
}

interface FontDatabase extends DBSchema {
  metadata: {
    key: string;
    value: StoredMetadata;
  };
  files: {
    key: string;
    value: StoredFontFile;
  };
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

class IndexedDbFontRepository implements FontRepository {
  private database?: IDBPDatabase<FontDatabase>;
  private snapshot: FontRepositorySnapshot = {
    schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
    families: [],
  };

  async initialize(): Promise<void> {
    if (this.database) {
      return;
    }
    this.database = await openDB<FontDatabase>(DATABASE_NAME, 1, {
      upgrade(database) {
        database.createObjectStore("metadata", { keyPath: "key" });
        database.createObjectStore("files", { keyPath: "storageKey" });
      },
    });
    this.snapshot = parseStoredFontSnapshot(
      (await this.database.get("metadata", SNAPSHOT_KEY))?.value,
    );
    await this.removeOrphanedFiles();
  }

  async listFamilies() {
    this.assertInitialized();
    return allFontFamilies(this.snapshot);
  }

  async installFont(input: InstallFontInput) {
    const database = this.requireDatabase();
    const prepared = await prepareFontInstall(input);
    const merged = mergeInstalledFamily(this.snapshot, prepared.family);
    const transaction = database.transaction(
      ["files", "metadata"],
      "readwrite",
    );
    try {
      await transaction.objectStore("files").put({
        storageKey: prepared.face.storageKey!,
        bytes: Uint8Array.from(input.bytes),
      });
      await transaction.objectStore("metadata").put({
        key: SNAPSHOT_KEY,
        value: merged.snapshot,
      });
      await transaction.done;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // A failed IndexedDB request may have already aborted the transaction.
      }
      if (isQuotaError(error)) {
        throw new FontRepositoryError(
          "storage-full",
          "浏览器本地空间不足，无法保存字体。",
          { cause: error },
        );
      }
      throw error;
    }
    this.snapshot = merged.snapshot;
    await this.deleteUnreferencedFiles(merged.replacedStorageKeys);
    return merged.family;
  }

  async readFace(faceId: string): Promise<Uint8Array | undefined> {
    const database = this.requireDatabase();
    const face = this.snapshot.families
      .flatMap((family) => family.faces)
      .find((item) => item.id === faceId);
    if (!face?.storageKey) {
      return undefined;
    }
    return (await database.get("files", face.storageKey))?.bytes;
  }

  async removeFamily(familyId: string): Promise<void> {
    const database = this.requireDatabase();
    const family = this.snapshot.families.find((item) => item.id === familyId);
    if (!family) {
      return;
    }
    const snapshot: FontRepositorySnapshot = {
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: this.snapshot.families.filter((item) => item.id !== familyId),
    };
    await database.put("metadata", { key: SNAPSHOT_KEY, value: snapshot });
    this.snapshot = snapshot;
    await this.deleteUnreferencedFiles(
      family.faces.flatMap((face) =>
        face.storageKey ? [face.storageKey] : [],
      ),
    );
  }

  async clearInstalledFonts(): Promise<void> {
    const database = this.requireDatabase();
    const transaction = database.transaction(
      ["metadata", "files"],
      "readwrite",
    );
    await Promise.all([
      transaction.objectStore("metadata").clear(),
      transaction.objectStore("files").clear(),
    ]);
    await transaction.done;
    this.snapshot = {
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: [],
    };
  }

  private async removeOrphanedFiles(): Promise<void> {
    const database = this.requireDatabase();
    const referenced = new Set(
      this.snapshot.families.flatMap((family) =>
        family.faces.flatMap((face) =>
          face.storageKey ? [face.storageKey] : [],
        ),
      ),
    );
    const keys = await database.getAllKeys("files");
    const transaction = database.transaction("files", "readwrite");
    await Promise.all(
      keys
        .filter((key) => !referenced.has(key))
        .map((key) => transaction.store.delete(key)),
    );
    await transaction.done;
  }

  private async deleteUnreferencedFiles(
    candidates: readonly string[],
  ): Promise<void> {
    const database = this.requireDatabase();
    const referenced = new Set(
      this.snapshot.families.flatMap((family) =>
        family.faces.flatMap((face) =>
          face.storageKey ? [face.storageKey] : [],
        ),
      ),
    );
    await Promise.all(
      [...new Set(candidates)]
        .filter((key) => !referenced.has(key))
        .map((key) => database.delete("files", key)),
    );
  }

  private assertInitialized(): void {
    this.requireDatabase();
  }

  private requireDatabase(): IDBPDatabase<FontDatabase> {
    if (!this.database) {
      throw new Error("FontRepository.initialize() 必须先调用。");
    }
    return this.database;
  }
}

export const fontRepository: FontRepository = new IndexedDbFontRepository();
