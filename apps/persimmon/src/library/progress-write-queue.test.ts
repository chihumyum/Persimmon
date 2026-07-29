import type { BookLocator } from "@persimmon/book-core";
import { describe, expect, it } from "vitest";

import {
  ProgressWriteQueue,
  type PendingReaderProgress,
} from "./progress-write-queue";

function snapshot(offset: number): PendingReaderProgress {
  const locator: BookLocator = {
    bookId: "book",
    revisionId: "revision",
    position: { sectionId: "section", blockId: "block", offset },
  };
  return {
    progress: {
      locator,
      sectionIndex: 0,
      pageIndex: offset,
      pageCount: 100,
      publicationProgress: offset / 100,
    },
    updatedAt: `2026-07-30T00:00:${String(offset).padStart(2, "0")}.000Z`,
  };
}

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("ProgressWriteQueue", () => {
  it("serializes writes and folds an in-flight burst into the newest snapshot", async () => {
    const firstWrite = deferred();
    const offsets: number[] = [];
    const queue = new ProgressWriteQueue(async ({ progress }) => {
      offsets.push(progress.locator.position.offset);
      if (offsets.length === 1) {
        await firstWrite.promise;
      }
    });

    queue.enqueue(snapshot(10));
    const flush = queue.flush();
    queue.enqueue(snapshot(20));
    queue.enqueue(snapshot(30));

    expect(offsets).toEqual([10]);
    firstWrite.resolve();
    await flush;
    expect(offsets).toEqual([10, 30]);
  });

  it("does not restore a failed old snapshot over a newer pending one", async () => {
    const firstWrite = deferred();
    const offsets: number[] = [];
    let failFirst = true;
    const queue = new ProgressWriteQueue(async ({ progress }) => {
      offsets.push(progress.locator.position.offset);
      if (failFirst) {
        failFirst = false;
        await firstWrite.promise;
      }
    });

    queue.enqueue(snapshot(10));
    const flush = queue.flush();
    queue.enqueue(snapshot(40));
    firstWrite.reject(new Error("storage failed"));
    await expect(flush).rejects.toThrow("storage failed");

    await queue.flush();
    expect(offsets).toEqual([10, 40]);
  });
});
