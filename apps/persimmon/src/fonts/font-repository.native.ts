import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FONT_REPOSITORY_SCHEMA_VERSION,
  type FontRepositorySnapshot,
} from "@persimmon/font-core";
import { Directory, File, Paths } from "expo-file-system";

import { translate } from "../i18n";
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

const SNAPSHOT_KEY = "@persimmon/fonts/v1/repository";
const MINIMUM_FREE_SPACE = 5 * 1024 * 1024;

class NativeFontRepository implements FontRepository {
  private readonly root = new Directory(Paths.document, "persimmon-fonts-v1");
  private readonly files = new Directory(this.root, "files");
  private readonly staging = new Directory(this.root, "staging");
  private snapshot: FontRepositorySnapshot = {
    schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
    families: [],
  };
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.root.create({ idempotent: true, intermediates: true });
    this.files.create({ idempotent: true });
    this.staging.create({ idempotent: true });
    for (const entry of this.staging.list()) {
      entry.delete();
    }
    const serialized = await AsyncStorage.getItem(SNAPSHOT_KEY);
    try {
      this.snapshot = parseStoredFontSnapshot(
        serialized ? (JSON.parse(serialized) as unknown) : undefined,
      );
    } catch {
      this.snapshot = parseStoredFontSnapshot(undefined);
    }
    this.removeOrphanedFiles();
    this.initialized = true;
  }

  async listFamilies() {
    this.assertInitialized();
    return allFontFamilies(this.snapshot);
  }

  async installFont(input: InstallFontInput) {
    this.assertInitialized();
    if (
      Paths.availableDiskSpace <
      input.bytes.byteLength + MINIMUM_FREE_SPACE
    ) {
      throw new FontRepositoryError(
        "storage-full",
        translate("errors.fonts.storageFull"),
      );
    }
    const prepared = await prepareFontInstall(input);
    const merged = mergeInstalledFamily(this.snapshot, prepared.family);
    const storageKey = prepared.face.storageKey!;
    const staged = new File(
      this.staging,
      `${storageKey}.${Date.now().toString(36)}`,
    );
    staged.write(input.bytes);
    if (staged.size !== input.bytes.byteLength) {
      staged.delete();
      throw new FontRepositoryError(
        "storage-full",
        translate("errors.fonts.storageFull"),
      );
    }
    const destination = new File(this.files, storageKey);
    try {
      if (!destination.exists) {
        await staged.move(destination);
      } else {
        staged.delete();
      }
      await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(merged.snapshot));
      this.snapshot = merged.snapshot;
      this.deleteUnreferencedFiles(merged.replacedStorageKeys);
      return merged.family;
    } catch (error) {
      if (staged.exists) {
        staged.delete();
      }
      if (
        destination.exists &&
        !this.isStorageKeyReferenced(destination.name)
      ) {
        destination.delete();
      }
      throw error;
    }
  }

  async readFace(faceId: string): Promise<Uint8Array | undefined> {
    this.assertInitialized();
    const face = this.snapshot.families
      .flatMap((family) => family.faces)
      .find((item) => item.id === faceId);
    if (!face?.storageKey) {
      return undefined;
    }
    const file = new File(this.files, face.storageKey);
    return file.exists ? file.bytes() : undefined;
  }

  async removeFamily(familyId: string): Promise<void> {
    this.assertInitialized();
    const family = this.snapshot.families.find((item) => item.id === familyId);
    if (!family) {
      return;
    }
    const snapshot: FontRepositorySnapshot = {
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: this.snapshot.families.filter((item) => item.id !== familyId),
    };
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    this.snapshot = snapshot;
    this.deleteUnreferencedFiles(
      family.faces.flatMap((face) =>
        face.storageKey ? [face.storageKey] : [],
      ),
    );
  }

  private removeOrphanedFiles(): void {
    const referenced = new Set(
      this.snapshot.families.flatMap((family) =>
        family.faces.flatMap((face) =>
          face.storageKey ? [face.storageKey] : [],
        ),
      ),
    );
    for (const entry of this.files.list()) {
      if (entry instanceof File && !referenced.has(entry.name)) {
        entry.delete();
      }
    }
  }

  private deleteUnreferencedFiles(candidates: readonly string[]): void {
    for (const storageKey of new Set(candidates)) {
      if (this.isStorageKeyReferenced(storageKey)) {
        continue;
      }
      const file = new File(this.files, storageKey);
      if (file.exists) {
        file.delete();
      }
    }
  }

  private isStorageKeyReferenced(storageKey: string): boolean {
    return this.snapshot.families.some((family) =>
      family.faces.some((face) => face.storageKey === storageKey),
    );
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error("FontRepository.initialize() must be called first");
    }
  }
}

export const fontRepository: FontRepository = new NativeFontRepository();
