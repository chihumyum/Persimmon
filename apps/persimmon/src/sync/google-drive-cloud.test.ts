import { describe, expect, it, vi } from "vitest";

import type { GoogleDriveClient } from "./google-drive-client";
import { GoogleDriveCloudRepository } from "./google-drive-cloud";

describe("GoogleDriveCloudRepository data deletion", () => {
  it("deletes every file in the app-specific hidden folder", async () => {
    const deleteFile = vi.fn(async (_fileId: string) => undefined);
    const client = {
      listAppDataFiles: vi.fn(async () => [
        { id: "book", name: "persimmon-book-v1-a.epub" },
        { id: "device", name: "persimmon-device-state-v1-b.json" },
        { id: "legacy", name: "older-persimmon-data" },
      ]),
      deleteFile,
    } as unknown as GoogleDriveClient;

    const deleted = await new GoogleDriveCloudRepository(client).clearAllData();

    expect(deleted).toBe(3);
    expect(deleteFile).toHaveBeenCalledTimes(3);
    expect(deleteFile.mock.calls.map(([fileId]) => fileId).sort()).toEqual([
      "book",
      "device",
      "legacy",
    ]);
  });
});
