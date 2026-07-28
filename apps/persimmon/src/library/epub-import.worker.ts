/// <reference lib="webworker" />

import { importEpub } from "@persimmon/epub-import";

interface ImportRequest {
  readonly id: string;
  readonly bytes: Uint8Array;
  readonly contentDigest: string;
}

interface ImportFailure {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly context?: string;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<ImportRequest>) => {
  const { id, bytes, contentDigest } = event.data;
  try {
    const result = importEpub(bytes, { contentDigest });
    const transfer = [
      ...new Set(
        Object.values(result.resources).flatMap((resource) =>
          resource.buffer instanceof ArrayBuffer ? [resource.buffer] : [],
        ),
      ),
    ];
    worker.postMessage({ id, result }, transfer);
  } catch (error) {
    const failure: ImportFailure =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            ...("code" in error && typeof error.code === "string"
              ? { code: error.code }
              : {}),
            ...("context" in error && typeof error.context === "string"
              ? { context: error.context }
              : {}),
          }
        : {
            name: "Error",
            message: "Unknown EPUB worker error",
          };
    worker.postMessage({ id, error: failure });
  }
});

export {};
