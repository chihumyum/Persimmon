const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const DEFAULT_MAX_CACHE_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_CACHE_ENTRIES = 96;

export interface CachedLibraryCover {
  readonly ratio?: number;
  readonly uri: string;
}

interface StoredLibraryCover extends CachedLibraryCover {
  readonly estimatedBytes: number;
}

export interface LibraryCoverCacheOptions {
  readonly maxBytes?: number;
  readonly maxEntries?: number;
}

function base64Of(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += BASE64_ALPHABET[first >> 2];
    output += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    output +=
      second === undefined
        ? "="
        : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? "=" : BASE64_ALPHABET[third & 0x3f];
  }
  return output;
}

function publicCover(entry: StoredLibraryCover): CachedLibraryCover {
  return {
    ...(entry.ratio === undefined ? {} : { ratio: entry.ratio }),
    uri: entry.uri,
  };
}

export function libraryCoverCacheKey(
  bookId: string,
  assetId: string,
  mediaType: string,
): string {
  return JSON.stringify([bookId, assetId, mediaType]);
}

/**
 * Retains only encoded cover sources across shelf remounts. The shelf UI and
 * decoded Image views still unmount while the reader is active.
 */
export class LibraryCoverCache {
  private readonly entries = new Map<string, StoredLibraryCover>();
  private readonly pending = new Map<
    string,
    Promise<CachedLibraryCover | undefined>
  >();
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private cachedBytes = 0;

  constructor(options: LibraryCoverCacheOptions = {}) {
    this.maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES);
    this.maxEntries = Math.max(
      1,
      options.maxEntries ?? DEFAULT_MAX_CACHE_ENTRIES,
    );
  }

  peek(key: string): CachedLibraryCover | undefined {
    const entry = this.entries.get(key);
    return entry ? publicCover(entry) : undefined;
  }

  load(
    key: string,
    mediaType: string,
    readBytes: () => Promise<Uint8Array | undefined>,
  ): Promise<CachedLibraryCover | undefined> {
    const cached = this.entries.get(key);
    if (cached) {
      this.touch(key, cached);
      return Promise.resolve(publicCover(cached));
    }
    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    const task = readBytes().then((bytes) => {
      if (!bytes) {
        return undefined;
      }
      const uri = `data:${mediaType};base64,${base64Of(bytes)}`;
      const entry: StoredLibraryCover = {
        estimatedBytes: uri.length * 2,
        uri,
      };
      this.store(key, entry);
      return publicCover(entry);
    });
    const trackedTask = task.finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, trackedTask);
    return trackedTask;
  }

  rememberRatio(key: string, ratio: number): void {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return;
    }
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    this.touch(key, { ...entry, ratio });
  }

  get entryCount(): number {
    return this.entries.size;
  }

  get estimatedByteLength(): number {
    return this.cachedBytes;
  }

  private store(key: string, entry: StoredLibraryCover): void {
    if (entry.estimatedBytes > this.maxBytes) {
      return;
    }
    const existing = this.entries.get(key);
    if (existing) {
      this.cachedBytes -= existing.estimatedBytes;
      this.entries.delete(key);
    }
    this.entries.set(key, entry);
    this.cachedBytes += entry.estimatedBytes;
    this.evictOverflow();
  }

  private touch(key: string, entry: StoredLibraryCover): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private evictOverflow(): void {
    while (
      this.entries.size > this.maxEntries ||
      this.cachedBytes > this.maxBytes
    ) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (oldest) {
        this.cachedBytes -= oldest.estimatedBytes;
      }
    }
  }
}

export const libraryCoverCache = new LibraryCoverCache();
