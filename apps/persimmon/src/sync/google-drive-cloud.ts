import type {
  GoogleDriveClient,
  DriveFileMetadata,
} from "./google-drive-client";
import type {
  CloudDeviceDocument,
  CloudSyncRepository,
  CloudSyncSnapshot,
  DeviceSyncDocument,
} from "./types";
import { parseDeviceSyncDocument } from "./validation";

const DEVICE_STATE_PREFIX = "persimmon-device-state-v1-";
const BOOK_BLOB_PREFIX = "persimmon-book-v1-";
const MAX_DEVICE_STATE_BYTES = 1024 * 1024;

function digestFromRevision(revisionId: string): string {
  const match = /^epub-revision:([a-f0-9]{64})$/.exec(revisionId);
  if (!match) {
    throw new Error(`不支持的 EPUB revisionId：${revisionId}`);
  }
  return match[1]!;
}

function bookFileName(revisionId: string): string {
  return `${BOOK_BLOB_PREFIX}${digestFromRevision(revisionId)}.epub`;
}

function deviceStateFileName(deviceId: string): string {
  return `${DEVICE_STATE_PREFIX}${deviceId}.json`;
}

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  concurrency: number,
  transform: (value: T) => Promise<U>,
): Promise<U[]> {
  const output = new Array<U>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        output[index] = await transform(values[index]!);
      }
    }),
  );
  return output;
}

export class GoogleDriveCloudRepository implements CloudSyncRepository {
  private files: DriveFileMetadata[] = [];

  constructor(private readonly client: GoogleDriveClient) {}

  async loadSnapshot(): Promise<CloudSyncSnapshot> {
    const [account, files] = await Promise.all([
      this.client.getAccount(),
      this.client.listAppDataFiles(),
    ]);
    this.files = [...files];
    const stateFiles = files.filter(
      (file) =>
        file.name.startsWith(DEVICE_STATE_PREFIX) &&
        file.name.endsWith(".json") &&
        Number(file.size ?? 0) <= MAX_DEVICE_STATE_BYTES,
    );
    const candidates = await mapWithConcurrency(
      stateFiles,
      6,
      async (file): Promise<CloudDeviceDocument | undefined> => {
        const bytes = await this.client.downloadFile(file.id);
        if (bytes.byteLength > MAX_DEVICE_STATE_BYTES) {
          return undefined;
        }
        try {
          const document = parseDeviceSyncDocument(
            JSON.parse(new TextDecoder().decode(bytes)),
          );
          return document ? { fileId: file.id, document } : undefined;
        } catch {
          return undefined;
        }
      },
    );
    return {
      account,
      deviceDocuments: candidates.filter(
        (entry): entry is CloudDeviceDocument => Boolean(entry),
      ),
    };
  }

  async ensureBook(
    revisionId: string,
    bytes: Uint8Array,
    expectedByteLength: number,
  ): Promise<boolean> {
    const name = bookFileName(revisionId);
    if (
      this.files.some(
        (file) =>
          file.name === name &&
          (!file.size || Number(file.size) === expectedByteLength),
      )
    ) {
      return false;
    }
    const uploaded = await this.client.uploadResumable(
      name,
      "application/epub+zip",
      bytes,
    );
    this.files.push(uploaded);
    return true;
  }

  async downloadBook(
    revisionId: string,
    expectedByteLength: number,
  ): Promise<Uint8Array> {
    const name = bookFileName(revisionId);
    const candidates = this.files
      .filter(
        (file) =>
          file.name === name &&
          (!file.size || Number(file.size) === expectedByteLength),
      )
      .sort((left, right) =>
        (right.modifiedTime ?? "").localeCompare(left.modifiedTime ?? ""),
      );
    const file = candidates[0];
    if (!file) {
      throw new Error(`云端缺少 EPUB 文件：${revisionId}`);
    }
    const bytes = await this.client.downloadFile(file.id);
    if (bytes.byteLength !== expectedByteLength) {
      throw new Error(`云端 EPUB 文件大小校验失败：${revisionId}`);
    }
    return bytes;
  }

  async saveDeviceDocument(
    document: DeviceSyncDocument,
    existingFileId?: string,
  ): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(document));
    if (bytes.byteLength > MAX_DEVICE_STATE_BYTES) {
      throw new Error("同步状态文件超过安全上限。");
    }
    const uploaded = await this.client.uploadResumable(
      deviceStateFileName(document.deviceId),
      "application/json",
      bytes,
      existingFileId,
    );
    const existingIndex = this.files.findIndex(
      (file) => file.id === uploaded.id,
    );
    if (existingIndex === -1) {
      this.files.push(uploaded);
    } else {
      this.files[existingIndex] = uploaded;
    }
    return uploaded.id;
  }
}
