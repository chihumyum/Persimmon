import { afterEach, describe, expect, it, vi } from "vitest";

import type { GoogleDriveAuth } from "./google-auth-types";
import { GoogleDriveClient } from "./google-drive-client";

function auth(): GoogleDriveAuth {
  return {
    isConfigured: () => true,
    initialize: async () => true,
    connect: async () => undefined,
    disconnect: async () => undefined,
    getAccessToken: async () => "access-token",
    invalidateAccessToken: async () => undefined,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GoogleDriveClient", () => {
  it("uploads binary data as an ArrayBuffer supported by native networking", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), ...(init ? { init } : {}) });
        if (requests.length === 1) {
          return new Response(null, {
            status: 200,
            headers: { location: "https://upload.example/session" },
          });
        }
        return Response.json({
          id: "drive-file",
          name: "book.epub",
          mimeType: "application/epub+zip",
          size: "4",
        });
      }),
    );

    const bytes = Uint8Array.from([0, 127, 128, 255]);
    const uploaded = await new GoogleDriveClient(auth()).uploadResumable(
      "book.epub",
      "application/epub+zip",
      bytes,
    );

    expect(uploaded.id).toBe("drive-file");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toContain("uploadType=resumable");
    expect(requests[1]?.url).toBe("https://upload.example/session");

    const upload = requests[1]?.init;
    expect(upload?.method).toBe("PUT");
    expect(new Headers(upload?.headers).get("Content-Type")).toBe(
      "application/epub+zip",
    );
    expect(upload?.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(upload?.body as ArrayBuffer))).toEqual([
      0, 127, 128, 255,
    ]);
  });
});
