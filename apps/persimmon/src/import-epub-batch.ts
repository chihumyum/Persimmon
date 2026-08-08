import type { PickedEpub } from "./pick-epub";

export interface EpubImportInput {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

export interface ImportedEpub<T> {
  readonly fileName: string;
  readonly value: T;
}

export interface FailedEpubImport {
  readonly error: unknown;
  readonly fileName: string;
}

export interface EpubBatchImportResult<T> {
  readonly failures: readonly FailedEpubImport[];
  readonly imported: readonly ImportedEpub<T>[];
}

export interface EpubBatchImportProgress {
  readonly completedBooks: number;
  readonly failedBooks: number;
  readonly importedBooks: number;
  readonly totalBooks: number;
  readonly currentFileName?: string;
}

export type EpubBatchImportProgressReporter = (
  progress: EpubBatchImportProgress,
) => void;

export async function importEpubBatch<T>(
  pickedEpubs: readonly PickedEpub[],
  importBook: (input: EpubImportInput) => Promise<T>,
  onProgress?: EpubBatchImportProgressReporter,
): Promise<EpubBatchImportResult<T>> {
  const imported: ImportedEpub<T>[] = [];
  const failures: FailedEpubImport[] = [];
  let completedBooks = 0;

  const reportProgress = (currentFileName?: string) => {
    onProgress?.({
      completedBooks,
      failedBooks: failures.length,
      importedBooks: imported.length,
      totalBooks: pickedEpubs.length,
      ...(currentFileName ? { currentFileName } : {}),
    });
  };

  for (const pickedEpub of pickedEpubs) {
    reportProgress(pickedEpub.fileName);
    try {
      const value = await importBook({
        bytes: await pickedEpub.readBytes(),
        fileName: pickedEpub.fileName,
      });
      imported.push({ fileName: pickedEpub.fileName, value });
    } catch (error) {
      failures.push({ error, fileName: pickedEpub.fileName });
    }
    completedBooks += 1;
    reportProgress();
  }

  return { failures, imported };
}
