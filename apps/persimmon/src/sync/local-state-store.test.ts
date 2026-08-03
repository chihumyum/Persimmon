import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
let nextDevice = 0;

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => `device-${++nextDevice}`),
}));

import { LocalSyncStateStore } from "./local-state-store";

describe("LocalSyncStateStore", () => {
  beforeEach(() => {
    storage.clear();
    nextDevice = 0;
  });

  it("removes prior sync identity when local sync state is cleared", async () => {
    const store = new LocalSyncStateStore();
    const first = await store.load();

    await store.clear();
    const second = await store.load();

    expect(first.deviceId).toBe("device-1");
    expect(second.deviceId).toBe("device-2");
    expect(second.books).toEqual({});
    expect(second.progress).toEqual({});
  });
});
