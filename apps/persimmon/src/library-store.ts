import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  validateBookIR,
  type BookIR,
  type BookLocator,
} from "@persimmon/book-core";

import { DEMO_BOOK } from "./demo-book";

const LIBRARY_KEY = "@persimmon/library/v1";

export interface LibraryEntry {
  id: string;
  book: BookIR;
  author?: string;
  sourceName: string;
  addedAt: string;
  builtIn?: boolean;
  locator?: BookLocator;
}

export function createDemoEntry(locator?: BookLocator): LibraryEntry {
  return {
    id: DEMO_BOOK.id,
    book: DEMO_BOOK,
    author: "Persimmon",
    sourceName: "内置试读",
    addedAt: "2026-07-23T00:00:00.000Z",
    builtIn: true,
    ...(locator ? { locator } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validEntry(value: unknown): value is LibraryEntry {
  if (!isRecord(value) || !isRecord(value.book)) {
    return false;
  }

  const candidate = value as unknown as LibraryEntry;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sourceName === "string" &&
    typeof candidate.addedAt === "string" &&
    candidate.id === candidate.book.id &&
    validateBookIR(candidate.book).length === 0
  );
}

function validDemoLocator(entry: LibraryEntry | undefined) {
  const locator = entry?.locator;
  return locator &&
    locator.bookId === DEMO_BOOK.id &&
    locator.revisionId === DEMO_BOOK.revisionId
    ? locator
    : undefined;
}

export async function loadLibrary(): Promise<LibraryEntry[]> {
  const serialized = await AsyncStorage.getItem(LIBRARY_KEY);
  if (!serialized) {
    return [createDemoEntry()];
  }

  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) {
    return [createDemoEntry()];
  }

  const valid = parsed.filter(validEntry);
  const previousDemo = valid.find(
    (entry) => entry.id === DEMO_BOOK.id,
  );
  const imported = valid.filter(
    (entry) => entry.id !== DEMO_BOOK.id,
  );
  return [
    createDemoEntry(validDemoLocator(previousDemo)),
    ...imported,
  ];
}

export async function saveLibrary(
  entries: readonly LibraryEntry[],
): Promise<void> {
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
}
