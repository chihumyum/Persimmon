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

export async function importEpubBatch<T>(
  pickedEpubs: readonly PickedEpub[],
  importBook: (input: EpubImportInput) => Promise<T>,
): Promise<EpubBatchImportResult<T>> {
  const imported: ImportedEpub<T>[] = [];
  const failures: FailedEpubImport[] = [];

  for (const pickedEpub of pickedEpubs) {
    try {
      const value = await importBook({
        bytes: await pickedEpub.readBytes(),
        fileName: pickedEpub.fileName,
      });
      imported.push({ fileName: pickedEpub.fileName, value });
    } catch (error) {
      failures.push({ error, fileName: pickedEpub.fileName });
    }
  }

  return { failures, imported };
}
