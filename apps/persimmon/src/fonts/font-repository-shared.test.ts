import {
  FONT_REPOSITORY_SCHEMA_VERSION,
  type FontFamilyRecord,
} from "@persimmon/font-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: vi.fn(),
}));

import {
  allFontFamilies,
  mergeInstalledFamily,
  parseStoredFontSnapshot,
} from "./font-repository-shared";

function family(
  digestCharacter: string,
  weight: 400 | 700 = 400,
): FontFamilyRecord {
  const sha256 = digestCharacter.repeat(64);
  return {
    id: "user:test",
    displayName: "Test",
    source: "user",
    category: "serif",
    faces: [
      {
        id: `user:test:${weight}:normal`,
        familyId: "user:test",
        weight,
        style: "normal",
        format: "ttf",
        sha256,
        byteLength: 10,
        storageKey: `${sha256}.ttf`,
        coverage: {
          latin: true,
          cjk: true,
          math: false,
          emoji: false,
        },
        variable: false,
      },
    ],
  };
}

describe("font repository metadata", () => {
  it("drops corrupt records without affecting bundled fonts", () => {
    const snapshot = parseStoredFontSnapshot({
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: [
        family("a"),
        {
          ...family("b"),
          id: "user:unsafe",
          faces: [
            {
              ...family("b").faces[0],
              familyId: "user:unsafe",
              storageKey: "../outside.ttf",
            },
          ],
        },
        { id: "broken" },
      ],
    });
    expect(snapshot.families).toHaveLength(1);
    expect(allFontFamilies(snapshot).map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "builtin:noto-serif-sc",
        "builtin:noto-sans-sc",
        "user:test",
      ]),
    );
  });

  it("replaces a matching face and keeps other weights", () => {
    const initial = {
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: [
        {
          ...family("a"),
          faces: [...family("a").faces, ...family("b", 700).faces],
        },
      ],
    };
    const merged = mergeInstalledFamily(initial, family("c"));
    expect(merged.family.faces.map((face) => face.weight)).toEqual([400, 700]);
    expect(merged.replacedStorageKeys).toEqual([`${"a".repeat(64)}.ttf`]);
  });
});
