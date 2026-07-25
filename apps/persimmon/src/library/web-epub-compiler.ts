import {
  EpubImportError,
  type EpubImportErrorCode,
  type EpubImportResult,
} from "@persimmon/epub-import";

interface ImportFailure {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly context?: string;
}

type ImportResponse =
  | {
      readonly id: string;
      readonly result: EpubImportResult;
    }
  | {
      readonly id: string;
      readonly error: ImportFailure;
    };

function errorFromWorker(failure: ImportFailure): Error {
  return failure.name === "EpubImportError" && failure.code
    ? new EpubImportError(
        failure.code as EpubImportErrorCode,
        failure.message,
        failure.context,
      )
    : new Error(failure.message);
}

export function compileEpubInWorker(
  bytes: Uint8Array,
  contentDigest: string,
): Promise<EpubImportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./epub-import.worker.ts", import.meta.url),
      { type: "module" },
    );
    const id = `${contentDigest}:${Date.now()}`;
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("EPUB import worker timed out"));
    }, 15_000);
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };

    worker.addEventListener(
      "message",
      (event: MessageEvent<ImportResponse>) => {
        if (event.data.id !== id) {
          return;
        }
        finish();
        if ("error" in event.data) {
          reject(errorFromWorker(event.data.error));
        } else {
          resolve(event.data.result);
        }
      },
    );
    worker.addEventListener("error", (event) => {
      finish();
      reject(new Error(event.message || "EPUB import worker failed"));
    });

    const transferableBytes = Uint8Array.from(bytes);
    worker.postMessage({ id, bytes: transferableBytes, contentDigest }, [
      transferableBytes.buffer,
    ]);
  });
}
