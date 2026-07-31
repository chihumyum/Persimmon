export interface DisposableNativePagerRecording {
  readonly byteSize: number;
  dispose(): void;
}

/**
 * Native Pager stock plans overlap heavily as the acknowledged page advances.
 * Retaining a small LRU of immutable SkPictures lets the next plan reuse those
 * recordings instead of rebuilding the same paragraphs on the RN thread.
 *
 * The cache covers one logical stock graph, while native texture residency is
 * bounded independently. Native takes its own bounded sk_sp reference during
 * stocking, so JS never needs to retain recordings from an older generation.
 */
export class NativePagerRecordingCache<
  Value extends DisposableNativePagerRecording,
> {
  private readonly entries = new Map<string, Value>();
  private retainedBytes = 0;

  constructor(
    readonly maximumEntries: number,
    readonly maximumBytes: number,
  ) {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries <= 0) {
      throw new RangeError("maximumEntries must be a positive safe integer");
    }
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
      throw new RangeError("maximumBytes must be a positive safe integer");
    }
  }

  getOrCreate(key: string, create: () => Value | null): Value | null {
    const existing = this.entries.get(key);
    if (existing) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing;
    }

    const value = create();
    if (!value) {
      return null;
    }
    this.entries.set(key, value);
    this.retainedBytes += value.byteSize;
    this.evictOverflow();
    return value;
  }

  clear(): void {
    for (const value of this.entries.values()) {
      value.dispose();
    }
    this.entries.clear();
    this.retainedBytes = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  get byteSize(): number {
    return this.retainedBytes;
  }

  private evictOverflow(): void {
    // Keep one oversize recording long enough for its caller to hand the
    // picture to native. Every normal population remains bounded by both
    // entry count and the conservative full-raster byte estimate.
    while (
      this.entries.size > this.maximumEntries ||
      (this.entries.size > 1 && this.retainedBytes > this.maximumBytes)
    ) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        return;
      }
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      this.retainedBytes = Math.max(
        0,
        this.retainedBytes - (oldest?.byteSize ?? 0),
      );
      oldest?.dispose();
    }
  }
}
