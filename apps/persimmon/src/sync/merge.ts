import type {
  DeviceSyncDocument,
  HybridClock,
  SyncBookMutation,
  SyncProgressMutation,
} from "./types";
import { compareClocks, latestClock } from "./clock";

export interface MergedSyncState {
  readonly books: Readonly<Record<string, SyncBookMutation>>;
  readonly progress: Readonly<Record<string, SyncProgressMutation>>;
  readonly latestClock?: HybridClock;
}

function takeLatest<T extends { readonly clock: HybridClock }>(
  target: Record<string, T>,
  key: string,
  candidate: T,
): void {
  const current = target[key];
  if (!current || compareClocks(candidate.clock, current.clock) > 0) {
    target[key] = candidate;
  }
}

export function mergeDeviceDocuments(
  documents: readonly DeviceSyncDocument[],
): MergedSyncState {
  const books: Record<string, SyncBookMutation> = {};
  const progress: Record<string, SyncProgressMutation> = {};
  const clocks: HybridClock[] = [];

  for (const document of documents) {
    for (const [bookId, mutation] of Object.entries(document.books)) {
      takeLatest(books, bookId, mutation);
      clocks.push(mutation.clock);
    }
    for (const [bookId, mutation] of Object.entries(document.progress)) {
      takeLatest(progress, bookId, mutation);
      clocks.push(mutation.clock);
    }
  }

  const newestClock = latestClock(clocks);
  return {
    books,
    progress,
    ...(newestClock ? { latestClock: newestClock } : {}),
  };
}
