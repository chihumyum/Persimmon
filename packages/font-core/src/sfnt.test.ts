import { afterEach, describe, expect, it, vi } from "vitest";

import { FontParseError, parseSfntFont } from "./sfnt";

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer).setUint16(offset, value, false);
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer).setUint32(offset, value, false);
}

function utf16be(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length * 2);
  for (let index = 0; index < value.length; index += 1) {
    writeU16(bytes, index * 2, value.charCodeAt(index));
  }
  return bytes;
}

function singleByte(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function makeNameTable(platformId: 1 | 3 = 3): Uint8Array {
  const encode = platformId === 3 ? utf16be : singleByte;
  const values = [
    { nameId: 1, value: encode("Test Serif") },
    { nameId: 2, value: encode("Italic") },
    { nameId: 6, value: encode("TestSerif-Italic") },
  ];
  const recordsLength = values.length * 12;
  const stringOffset = 6 + recordsLength;
  const byteLength =
    stringOffset + values.reduce((sum, value) => sum + value.value.length, 0);
  const bytes = new Uint8Array(byteLength);
  writeU16(bytes, 2, values.length);
  writeU16(bytes, 4, stringOffset);
  let valueOffset = 0;
  values.forEach((entry, index) => {
    const record = 6 + index * 12;
    writeU16(bytes, record, platformId);
    writeU16(bytes, record + 2, platformId === 3 ? 1 : 0);
    writeU16(bytes, record + 4, platformId === 3 ? 0x0409 : 0);
    writeU16(bytes, record + 6, entry.nameId);
    writeU16(bytes, record + 8, entry.value.length);
    writeU16(bytes, record + 10, valueOffset);
    bytes.set(entry.value, stringOffset + valueOffset);
    valueOffset += entry.value.length;
  });
  return bytes;
}

function makeCmapTable(): Uint8Array {
  const codePoints = [0x0041, 0x2211, 0x4e2d, 0x1f600];
  const subtableLength = 16 + codePoints.length * 12;
  const bytes = new Uint8Array(12 + subtableLength);
  writeU16(bytes, 2, 1);
  writeU16(bytes, 4, 3);
  writeU16(bytes, 6, 10);
  writeU32(bytes, 8, 12);
  writeU16(bytes, 12, 12);
  writeU32(bytes, 16, subtableLength);
  writeU32(bytes, 24, codePoints.length);
  codePoints.forEach((codePoint, index) => {
    const group = 28 + index * 12;
    writeU32(bytes, group, codePoint);
    writeU32(bytes, group + 4, codePoint);
    writeU32(bytes, group + 8, index + 1);
  });
  return bytes;
}

function makeSfnt(
  signature: "ttf" | "otf" = "ttf",
  corruptNameOffset = false,
  namePlatformId: 1 | 3 = 3,
): Uint8Array {
  const os2 = new Uint8Array(42);
  writeU16(os2, 4, 650);
  writeU16(os2, 8, 0x0008);
  os2[33] = 2;
  const head = new Uint8Array(46);
  writeU16(head, 44, 0x0002);
  const tables = [
    { tag: "name", bytes: makeNameTable(namePlatformId) },
    { tag: "OS/2", bytes: os2 },
    { tag: "head", bytes: head },
    { tag: "cmap", bytes: makeCmapTable() },
    { tag: "fvar", bytes: new Uint8Array(4) },
  ];
  const directoryLength = 12 + tables.length * 16;
  const totalLength =
    directoryLength +
    tables.reduce((sum, table) => sum + table.bytes.length, 0);
  const bytes = new Uint8Array(totalLength);
  if (signature === "otf") {
    bytes.set([0x4f, 0x54, 0x54, 0x4f], 0);
  } else {
    bytes.set([0x00, 0x01, 0x00, 0x00], 0);
  }
  writeU16(bytes, 4, tables.length);
  let tableOffset = directoryLength;
  tables.forEach((table, index) => {
    const record = 12 + index * 16;
    bytes.set(
      [...table.tag].map((character) => character.charCodeAt(0)),
      record,
    );
    writeU32(
      bytes,
      record + 8,
      corruptNameOffset && table.tag === "name" ? totalLength + 1 : tableOffset,
    );
    writeU32(bytes, record + 12, table.bytes.length);
    bytes.set(table.bytes, tableOffset);
    tableOffset += table.bytes.length;
  });
  return bytes;
}

describe("SFNT font metadata parser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts names, style, coverage, and restrictions without rendering", () => {
    expect(parseSfntFont(makeSfnt("otf"))).toEqual({
      familyName: "Test Serif",
      subfamilyName: "Italic",
      postscriptName: "TestSerif-Italic",
      weight: 700,
      style: "italic",
      category: "serif",
      format: "otf",
      coverage: {
        latin: true,
        cjk: true,
        math: true,
        emoji: true,
      },
      variable: true,
      embeddingRestrictions: 0x0008,
    });
  });

  it("rejects unsupported containers and out-of-range table data", () => {
    expect(() => parseSfntFont(new Uint8Array())).toThrow(FontParseError);
    expect(() =>
      parseSfntFont(
        Uint8Array.from([0x74, 0x74, 0x63, 0x66, 0, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toThrow("TTC/OTC");
    expect(() => parseSfntFont(makeSfnt("ttf", true))).toThrow(
      "超出字体文件范围",
    );
  });

  it("decodes legacy single-byte names when TextDecoder lacks latin1", () => {
    vi.stubGlobal(
      "TextDecoder",
      class UnsupportedTextDecoder {
        constructor() {
          throw new RangeError("Unknown encoding: latin1");
        }
      },
    );

    expect(parseSfntFont(makeSfnt("ttf", false, 1)).familyName).toBe(
      "Test Serif",
    );
  });
});
