import type { EpubBatchImportProgress } from "../import-epub-batch";

export const IMPORT_COMPLETION_VISIBLE_MS = 2_000;

export interface LibraryImportStatus extends EpubBatchImportProgress {
  readonly phase: "importing" | "complete";
}

export function importProgressFraction(
  progress: EpubBatchImportProgress,
): number {
  if (progress.totalBooks <= 0) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(0, progress.completedBooks / progress.totalBooks),
  );
}
