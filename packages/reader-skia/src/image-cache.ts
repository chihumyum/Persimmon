import { Skia, type SkImage } from "@shopify/react-native-skia";

interface CacheEntry {
  readonly image: SkImage;
  readonly decodedBytes: number;
  lastUsed: number;
  pinned: boolean;
}

export type ResourceLoader = (
  assetId: string,
) => Promise<Uint8Array | undefined>;

export type DecodedImageStatus =
  | "unrequested"
  | "loading"
  | "ready"
  | "unavailable";

export class DecodedImageCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<SkImage | null>>();
  private readonly unavailable = new Set<string>();
  private usageCounter = 0;
  private decodedBytes = 0;
  private contentRevision = 0;

  constructor(readonly byteBudget: number) {
    if (!Number.isSafeInteger(byteBudget) || byteBudget <= 0) {
      throw new RangeError("image cache byteBudget must be positive");
    }
  }

  get sizeInBytes(): number {
    return this.decodedBytes;
  }

  get count(): number {
    return this.entries.size;
  }

  /**
   * Advances only when a decoded image is installed. Callers can safely mirror
   * this value into React state: cache hits and repeated subscribers to the
   * same in-flight request all observe the same revision.
   */
  get revision(): number {
    return this.contentRevision;
  }

  get(assetId: string): SkImage | undefined {
    const entry = this.entries.get(assetId);
    if (entry) {
      entry.lastUsed = ++this.usageCounter;
    }
    return entry?.image;
  }

  getStatus(assetId: string): DecodedImageStatus {
    if (this.entries.has(assetId)) {
      return "ready";
    }
    if (this.pending.has(assetId)) {
      return "loading";
    }
    return this.unavailable.has(assetId) ? "unavailable" : "unrequested";
  }

  async load(
    assetId: string,
    loadResource: ResourceLoader,
  ): Promise<SkImage | null> {
    const cached = this.get(assetId);
    if (cached) {
      return cached;
    }
    const inFlight = this.pending.get(assetId);
    if (inFlight) {
      return inFlight;
    }
    if (this.unavailable.has(assetId)) {
      return null;
    }

    const request = Promise.resolve()
      .then(() => loadResource(assetId))
      .then((bytes) => {
        if (!bytes) {
          this.unavailable.add(assetId);
          return null;
        }
        const data = Skia.Data.fromBytes(bytes);
        try {
          const image = Skia.Image.MakeImageFromEncoded(data);
          if (!image) {
            this.unavailable.add(assetId);
            return null;
          }
          const decodedBytes = image.width() * image.height() * 4;
          this.unavailable.delete(assetId);
          this.entries.set(assetId, {
            image,
            decodedBytes,
            lastUsed: ++this.usageCounter,
            pinned: false,
          });
          this.decodedBytes += decodedBytes;
          this.contentRevision += 1;
          this.evict();
          return image;
        } finally {
          data.dispose();
        }
      })
      .catch((error: unknown) => {
        this.unavailable.add(assetId);
        console.warn(
          `[Persimmon] Failed to load image asset ${assetId}; using placeholder.`,
          error,
        );
        return null;
      })
      .finally(() => {
        this.pending.delete(assetId);
      });
    this.pending.set(assetId, request);
    return request;
  }

  pinOnly(assetIds: ReadonlySet<string>): void {
    for (const [assetId, entry] of this.entries) {
      entry.pinned = assetIds.has(assetId);
      if (entry.pinned) {
        entry.lastUsed = ++this.usageCounter;
      }
    }
    this.evict();
  }

  dispose(): void {
    this.entries.clear();
    this.pending.clear();
    this.unavailable.clear();
    this.decodedBytes = 0;
    this.contentRevision = 0;
  }

  private evict(): void {
    if (this.decodedBytes <= this.byteBudget) {
      return;
    }
    const candidates = [...this.entries]
      .filter(([, entry]) => !entry.pinned)
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed);
    for (const [assetId, entry] of candidates) {
      if (this.decodedBytes <= this.byteBudget) {
        break;
      }
      this.entries.delete(assetId);
      this.decodedBytes -= entry.decodedBytes;
    }
  }
}
