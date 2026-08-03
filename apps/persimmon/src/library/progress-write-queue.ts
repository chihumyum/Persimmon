import type { ReaderProgress } from "@persimmon/reader-skia";

export interface PendingReaderProgress {
  readonly progress: ReaderProgress;
  readonly updatedAt: string;
}

export type ProgressSnapshotWriter = (
  snapshot: PendingReaderProgress,
) => Promise<void>;

/**
 * Keeps exactly one progress write in flight and folds bursts into the newest
 * pending snapshot. This prevents a slower, older storage operation from
 * completing after a newer locator.
 */
export class ProgressWriteQueue {
  private pending?: PendingReaderProgress;
  private active?: Promise<void>;

  constructor(private readonly write: ProgressSnapshotWriter) {}

  enqueue(snapshot: PendingReaderProgress): void {
    this.pending = snapshot;
  }

  hasPending(): boolean {
    return Boolean(this.pending);
  }

  discardPending(): void {
    this.pending = undefined;
  }

  flush(): Promise<void> {
    if (this.active) {
      return this.active;
    }
    const active = this.drain().finally(() => {
      if (this.active === active) {
        this.active = undefined;
      }
    });
    this.active = active;
    return active;
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const snapshot = this.pending;
      this.pending = undefined;
      try {
        await this.write(snapshot);
      } catch (error) {
        // A newer snapshot always wins. Retry the failed one only when nothing
        // newer arrived while its write was in flight.
        this.pending ??= snapshot;
        throw error;
      }
    }
  }
}
