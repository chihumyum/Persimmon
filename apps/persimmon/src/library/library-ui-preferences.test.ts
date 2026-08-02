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
  dismissGoogleDrivePrompt,
  loadGoogleDrivePromptDismissed,
} from "./library-ui-preferences";

describe("Google Drive connection prompt preference", () => {
  beforeEach(() => storage.clear());

  it("shows the prompt by default and permanently records dismissal", async () => {
    await expect(loadGoogleDrivePromptDismissed()).resolves.toBe(false);

    await dismissGoogleDrivePrompt();

    await expect(loadGoogleDrivePromptDismissed()).resolves.toBe(true);
  });

  it("migrates the old hidden-banner preference as a dismissal", async () => {
    storage.set("@persimmon/library/sync-banner-visible/v1", "false");

    await expect(loadGoogleDrivePromptDismissed()).resolves.toBe(true);
  });
});
