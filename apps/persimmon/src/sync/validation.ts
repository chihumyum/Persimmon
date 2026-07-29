import type { BookLocator } from "@persimmon/book-core";

import {
  SYNC_SCHEMA_VERSION,
  type DeviceSyncDocument,
  type HybridClock,
  type SyncBookMutation,
  type SyncProgressMutation,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isClock(value: unknown): value is HybridClock {
  if (!isRecord(value)) {
    return false;
  }
  return (
    Number.isSafeInteger(value.wallTime) &&
    (value.wallTime as number) >= 0 &&
    Number.isSafeInteger(value.counter) &&
    (value.counter as number) >= 0 &&
    isNonEmptyString(value.deviceId)
  );
}

function isLocator(value: unknown): value is BookLocator {
  if (!isRecord(value) || !isRecord(value.position)) {
    return false;
  }
  return (
    isNonEmptyString(value.bookId) &&
    isNonEmptyString(value.revisionId) &&
    isNonEmptyString(value.position.sectionId) &&
    isNonEmptyString(value.position.blockId) &&
    Number.isSafeInteger(value.position.offset) &&
    (value.position.offset as number) >= 0 &&
    (value.affinity === undefined ||
      value.affinity === "forward" ||
      value.affinity === "backward")
  );
}

function isBookMutation(
  value: unknown,
  expectedBookId: string,
  expectedDeviceId: string,
): value is SyncBookMutation {
  if (
    !isRecord(value) ||
    value.bookId !== expectedBookId ||
    !isClock(value.clock) ||
    value.clock.deviceId !== expectedDeviceId
  ) {
    return false;
  }
  if (value.kind === "delete") {
    return true;
  }
  return (
    value.kind === "upsert" &&
    isNonEmptyString(value.revisionId) &&
    isNonEmptyString(value.fileName) &&
    isNonEmptyString(value.title) &&
    (value.author === undefined || typeof value.author === "string") &&
    isNonEmptyString(value.addedAt) &&
    Number.isSafeInteger(value.byteLength) &&
    (value.byteLength as number) > 0
  );
}

function isProgressMutation(
  value: unknown,
  expectedBookId: string,
  expectedDeviceId: string,
): value is SyncProgressMutation {
  return (
    isRecord(value) &&
    isClock(value.clock) &&
    value.clock.deviceId === expectedDeviceId &&
    isLocator(value.locator) &&
    value.locator.bookId === expectedBookId &&
    (value.publicationProgress === undefined ||
      (typeof value.publicationProgress === "number" &&
        Number.isFinite(value.publicationProgress) &&
        value.publicationProgress >= 0 &&
        value.publicationProgress <= 1))
  );
}

export function parseDeviceSyncDocument(
  value: unknown,
): DeviceSyncDocument | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SYNC_SCHEMA_VERSION ||
    !isNonEmptyString(value.deviceId) ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 0 ||
    !isRecord(value.books) ||
    !isRecord(value.progress)
  ) {
    return undefined;
  }

  for (const [bookId, mutation] of Object.entries(value.books)) {
    if (!isBookMutation(mutation, bookId, value.deviceId)) {
      return undefined;
    }
  }
  for (const [bookId, mutation] of Object.entries(value.progress)) {
    if (!isProgressMutation(mutation, bookId, value.deviceId)) {
      return undefined;
    }
  }

  return value as unknown as DeviceSyncDocument;
}
