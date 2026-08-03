import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

import { latestClock } from "./clock";
import {
  SYNC_SCHEMA_VERSION,
  type HybridClock,
  type LocalSyncState,
} from "./types";
import { parseDeviceSyncDocument } from "./validation";

const LOCAL_SYNC_STATE_KEY = "@persimmon/google-drive-sync/v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createLocalState(): LocalSyncState {
  const deviceId = randomUUID();
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId,
    generation: 0,
    lastClock: { wallTime: 0, counter: 0, deviceId },
    knownBooks: {},
    knownProgress: {},
    books: {},
    progress: {},
    accounts: {},
  };
}

function parseLocalState(value: unknown): LocalSyncState | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SYNC_SCHEMA_VERSION ||
    typeof value.deviceId !== "string" ||
    !Number.isSafeInteger(value.generation) ||
    !isRecord(value.knownBooks) ||
    !isRecord(value.knownProgress) ||
    !isRecord(value.accounts)
  ) {
    return undefined;
  }

  const document = parseDeviceSyncDocument({
    schemaVersion: value.schemaVersion,
    deviceId: value.deviceId,
    generation: value.generation,
    books: value.books,
    progress: value.progress,
  });
  if (!document) {
    return undefined;
  }

  const allClocks = [
    ...Object.values(document.books).map((mutation) => mutation.clock),
    ...Object.values(document.progress).map((mutation) => mutation.clock),
  ];
  const inferredClock =
    latestClock(allClocks) ??
    ({ wallTime: 0, counter: 0, deviceId: document.deviceId } as HybridClock);
  const lastClock =
    isRecord(value.lastClock) &&
    Number.isSafeInteger(value.lastClock.wallTime) &&
    Number.isSafeInteger(value.lastClock.counter) &&
    value.lastClock.deviceId === document.deviceId
      ? (value.lastClock as unknown as HybridClock)
      : inferredClock;

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId: document.deviceId,
    generation: document.generation,
    lastClock,
    knownBooks: value.knownBooks as LocalSyncState["knownBooks"],
    knownProgress: value.knownProgress as LocalSyncState["knownProgress"],
    books: document.books,
    progress: document.progress,
    accounts: value.accounts as LocalSyncState["accounts"],
  };
}

export class LocalSyncStateStore {
  async load(): Promise<LocalSyncState> {
    const serialized = await AsyncStorage.getItem(LOCAL_SYNC_STATE_KEY);
    if (!serialized) {
      const state = createLocalState();
      await this.save(state);
      return state;
    }

    try {
      const state = parseLocalState(JSON.parse(serialized));
      if (state) {
        return state;
      }
    } catch {
      // Reconciliation recreates sync metadata from the authoritative library.
    }

    const state = createLocalState();
    await this.save(state);
    return state;
  }

  async save(state: LocalSyncState): Promise<void> {
    await AsyncStorage.setItem(LOCAL_SYNC_STATE_KEY, JSON.stringify(state));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(LOCAL_SYNC_STATE_KEY);
  }
}
