import { describe, expect, it, vi } from "vitest";

import { importEpubBatch } from "./import-epub-batch";
import type { PickedEpub } from "./pick-epub";

function pickedEpub(
  fileName: string,
  bytesOrError: Uint8Array | Error,
): PickedEpub {
  return {
    fileName,
    readBytes: () =>
      bytesOrError instanceof Error
        ? Promise.reject(bytesOrError)
        : Promise.resolve(bytesOrError),
  };
}

describe("importEpubBatch", () => {
  it("continues importing later books when one book fails", async () => {
    const importBook = vi.fn(async ({ fileName }: { fileName: string }) => {
      if (fileName === "broken.epub") {
        throw new Error("malformed EPUB");
      }
      return fileName.replace(".epub", "");
    });

    const result = await importEpubBatch(
      [
        pickedEpub("first.epub", new Uint8Array([1])),
        pickedEpub("broken.epub", new Uint8Array([2])),
        pickedEpub("last.epub", new Uint8Array([3])),
      ],
      importBook,
    );

    expect(importBook).toHaveBeenCalledTimes(3);
    expect(result.imported).toEqual([
      { fileName: "first.epub", value: "first" },
      { fileName: "last.epub", value: "last" },
    ]);
    expect(result.failures).toEqual([
      { error: expect.any(Error), fileName: "broken.epub" },
    ]);
  });

  it("isolates file-read failures without calling the importer for that file", async () => {
    const importBook = vi.fn(async ({ fileName }: { fileName: string }) =>
      fileName.replace(".epub", ""),
    );

    const result = await importEpubBatch(
      [
        pickedEpub("unreadable.epub", new Error("read failed")),
        pickedEpub("readable.epub", new Uint8Array([1, 2, 3])),
      ],
      importBook,
    );

    expect(importBook).toHaveBeenCalledTimes(1);
    expect(result.imported).toEqual([
      { fileName: "readable.epub", value: "readable" },
    ]);
    expect(result.failures[0]?.fileName).toBe("unreadable.epub");
  });

  it("reads and imports books sequentially", async () => {
    const events: string[] = [];
    const first: PickedEpub = {
      fileName: "first.epub",
      readBytes: async () => {
        events.push("read first");
        return new Uint8Array([1]);
      },
    };
    const second: PickedEpub = {
      fileName: "second.epub",
      readBytes: async () => {
        events.push("read second");
        return new Uint8Array([2]);
      },
    };

    await importEpubBatch([first, second], async ({ fileName }) => {
      events.push(`import ${fileName}`);
      return fileName;
    });

    expect(events).toEqual([
      "read first",
      "import first.epub",
      "read second",
      "import second.epub",
    ]);
  });

  it("reports determinate per-book progress across successes and failures", async () => {
    const progress = vi.fn();

    await importEpubBatch(
      [
        pickedEpub("first.epub", new Uint8Array([1])),
        pickedEpub("broken.epub", new Error("read failed")),
      ],
      async ({ fileName }) => fileName,
      progress,
    );

    expect(progress.mock.calls.map(([value]) => value)).toEqual([
      {
        completedBooks: 0,
        failedBooks: 0,
        importedBooks: 0,
        totalBooks: 2,
        currentFileName: "first.epub",
      },
      {
        completedBooks: 1,
        failedBooks: 0,
        importedBooks: 1,
        totalBooks: 2,
      },
      {
        completedBooks: 1,
        failedBooks: 0,
        importedBooks: 1,
        totalBooks: 2,
        currentFileName: "broken.epub",
      },
      {
        completedBooks: 2,
        failedBooks: 1,
        importedBooks: 1,
        totalBooks: 2,
      },
    ]);
  });
});
