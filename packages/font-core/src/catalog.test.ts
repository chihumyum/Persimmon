import { describe, expect, it } from "vitest";

import { parseDownloadableFontCatalog } from "./catalog";

const digest = "0123456789abcdef".repeat(4);

describe("downloadable font catalog", () => {
  it("accepts a versioned HTTPS catalog", () => {
    expect(
      parseDownloadableFontCatalog({
        schemaVersion: 1,
        families: [
          {
            id: "download:noto-serif-sc",
            displayName: "Noto Serif SC",
            category: "serif",
            description: "A font",
            license: {
              name: "OFL-1.1",
              url: "https://openfontlicense.org",
              redistributable: true,
            },
            faces: [
              {
                id: "download:noto-serif-sc:400",
                weight: 400,
                style: "normal",
                format: "otf",
                url: "https://example.com/font.otf",
                sha256: digest.toUpperCase(),
                byteLength: 1024,
              },
            ],
          },
        ],
      }).families[0]?.faces[0]?.sha256,
    ).toBe(digest);
  });

  it("rejects insecure, malformed, and duplicate records", () => {
    expect(() =>
      parseDownloadableFontCatalog({
        schemaVersion: 1,
        families: [
          {
            id: "bad",
            displayName: "Bad",
            category: "serif",
            license: { name: "OFL", redistributable: true },
            faces: [
              {
                id: "bad:400",
                weight: 400,
                style: "normal",
                format: "ttf",
                url: "http://example.com/font.ttf",
                sha256: digest,
                byteLength: 100,
              },
            ],
          },
        ],
      }),
    ).toThrow("无效字体记录");

    expect(() =>
      parseDownloadableFontCatalog({
        schemaVersion: 1,
        families: [
          {
            id: "duplicate",
            displayName: "First",
            category: "sans",
            license: { name: "OFL", redistributable: true },
            faces: [
              {
                id: "first:400",
                weight: 400,
                style: "normal",
                format: "ttf",
                url: "https://example.com/first.ttf",
                sha256: digest,
                byteLength: 100,
              },
            ],
          },
          {
            id: "duplicate",
            displayName: "Second",
            category: "sans",
            license: { name: "OFL", redistributable: true },
            faces: [
              {
                id: "second:400",
                weight: 400,
                style: "normal",
                format: "ttf",
                url: "https://example.com/second.ttf",
                sha256: digest,
                byteLength: 100,
              },
            ],
          },
        ],
      }),
    ).toThrow("重复 family ID");
  });

  it("rejects invalid weights and duplicate face IDs", () => {
    const face = {
      id: "shared-face",
      weight: 400,
      style: "normal",
      format: "ttf",
      url: "https://example.com/font.ttf",
      sha256: digest,
      byteLength: 100,
    };
    const family = (id: string, faces: readonly unknown[]) => ({
      id,
      displayName: id,
      category: "serif",
      license: { name: "OFL", redistributable: true },
      faces,
    });

    expect(() =>
      parseDownloadableFontCatalog({
        schemaVersion: 1,
        families: [family("invalid-weight", [{ ...face, weight: 450 }])],
      }),
    ).toThrow("无效字体记录");

    expect(() =>
      parseDownloadableFontCatalog({
        schemaVersion: 1,
        families: [family("first", [face]), family("second", [face])],
      }),
    ).toThrow("重复 face ID");
  });
});
