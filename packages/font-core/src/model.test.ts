import { describe, expect, it } from "vitest";

import {
  BUILTIN_READER_SANS_ID,
  BUILTIN_READER_SERIF_ID,
  normalizeFontWeight,
  normalizeReaderFontSettings,
  resolveAvailableFontId,
  type FontFamilyRecord,
} from "./model";

const availableFonts: readonly FontFamilyRecord[] = [
  {
    id: BUILTIN_READER_SERIF_ID,
    displayName: "Noto Serif SC",
    source: "bundled",
    category: "serif",
    faces: [],
  },
  {
    id: "user:source-han-serif",
    displayName: "Source Han Serif",
    source: "user",
    category: "serif",
    faces: [],
  },
];

describe("reader font settings", () => {
  it("migrates the legacy serif/sans choice", () => {
    expect(normalizeReaderFontSettings(undefined, "sans")).toEqual({
      selectedFontId: BUILTIN_READER_SANS_ID,
      useBookEmbeddedFonts: false,
    });
    expect(normalizeReaderFontSettings(undefined, "serif")).toEqual({
      selectedFontId: BUILTIN_READER_SERIF_ID,
      useBookEmbeddedFonts: false,
    });
  });

  it("keeps a valid modern setting and sanitizes malformed fields", () => {
    expect(
      normalizeReaderFontSettings({
        selectedFontId: "user:source-han-serif",
        useBookEmbeddedFonts: true,
      }),
    ).toEqual({
      selectedFontId: "user:source-han-serif",
      useBookEmbeddedFonts: true,
    });
    expect(
      normalizeReaderFontSettings({
        selectedFontId: " ",
        useBookEmbeddedFonts: "yes",
      }),
    ).toEqual({
      selectedFontId: BUILTIN_READER_SERIF_ID,
      useBookEmbeddedFonts: false,
    });
  });

  it("falls back when a synchronized font is unavailable on this device", () => {
    expect(resolveAvailableFontId("downloaded:missing", availableFonts)).toBe(
      BUILTIN_READER_SERIF_ID,
    );
    expect(
      resolveAvailableFontId("user:source-han-serif", availableFonts),
    ).toBe("user:source-han-serif");
  });

  it("normalizes arbitrary font weights to supported CSS hundreds", () => {
    expect(normalizeFontWeight(Number.NaN)).toBe(400);
    expect(normalizeFontWeight(49)).toBe(100);
    expect(normalizeFontWeight(449)).toBe(400);
    expect(normalizeFontWeight(950)).toBe(900);
  });
});
