import { describe, expect, it } from "vitest";

import { SYNC_SCHEMA_VERSION } from "./types";
import { parseDeviceSyncDocument } from "./validation";

describe("remote sync document validation", () => {
  it("rejects a mutation whose clock belongs to another device", () => {
    expect(
      parseDeviceSyncDocument({
        schemaVersion: SYNC_SCHEMA_VERSION,
        deviceId: "device-a",
        generation: 1,
        books: {
          book: {
            kind: "delete",
            bookId: "book",
            clock: {
              wallTime: 1,
              counter: 0,
              deviceId: "device-b",
            },
          },
        },
        progress: {},
      }),
    ).toBeUndefined();
  });
});
