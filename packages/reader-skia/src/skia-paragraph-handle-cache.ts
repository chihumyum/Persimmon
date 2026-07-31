interface DisposableParagraphHandle {
  dispose(): void;
}

/**
 * Bounds the native paragraphs materialized by the reader's visible and
 * prefetched page window. Pagination metadata remains available for the whole
 * section, while native text objects follow the Pager runway as an LRU.
 */
export class SkiaParagraphHandleCache<
  THandle extends DisposableParagraphHandle,
> {
  private readonly entries = new Map<string, THandle>();

  constructor(
    private readonly maximumEntries: number,
    private readonly retire: (handle: THandle) => void,
  ) {
    if (!Number.isInteger(maximumEntries) || maximumEntries < 1) {
      throw new RangeError("maximumEntries must be a positive integer");
    }
  }

  getOrCreate(key: string, create: () => THandle): THandle {
    const retained = this.entries.get(key);
    if (retained) {
      this.entries.delete(key);
      this.entries.set(key, retained);
      return retained;
    }

    const handle = create();
    this.entries.set(key, handle);
    this.trim();
    return handle;
  }

  release(key: string): void {
    const retained = this.entries.get(key);
    if (!retained) {
      return;
    }
    this.entries.delete(key);
    this.retire(retained);
  }

  clear(): void {
    const retained = [...this.entries.values()];
    this.entries.clear();
    for (const handle of retained) {
      this.retire(handle);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  private trim(): void {
    while (this.entries.size > this.maximumEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (oldest) {
        this.retire(oldest);
      }
    }
  }
}
