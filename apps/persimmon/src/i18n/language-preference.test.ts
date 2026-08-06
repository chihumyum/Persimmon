import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

import {
  loadAppLanguagePreference,
  saveAppLanguagePreference,
} from "./language-preference";

describe("app language preference", () => {
  beforeEach(() => storage.clear());

  it("follows the system by default", async () => {
    await expect(loadAppLanguagePreference()).resolves.toBe("system");
  });

  it("persists an explicit language override", async () => {
    await saveAppLanguagePreference("ja");

    await expect(loadAppLanguagePreference()).resolves.toBe("ja");
  });

  it("ignores unknown persisted values", async () => {
    storage.set("@persimmon/app-language/v1", "it");

    await expect(loadAppLanguagePreference()).resolves.toBe("system");
  });
});
