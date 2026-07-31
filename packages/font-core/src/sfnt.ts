import {
  normalizeFontWeight,
  type FontCategory,
  type FontCoverage,
  type FontFaceStyle,
  type FontFileFormat,
} from "./model";

export const MAX_USER_FONT_BYTES = 64 * 1024 * 1024;
const MAX_TABLES = 512;

export type FontParseErrorCode =
  | "empty-font"
  | "font-too-large"
  | "unsupported-format"
  | "invalid-font";

export class FontParseError extends Error {
  constructor(
    readonly code: FontParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FontParseError";
  }
}

export interface ParsedFontMetadata {
  readonly familyName: string;
  readonly subfamilyName?: string;
  readonly postscriptName?: string;
  readonly weight: number;
  readonly style: FontFaceStyle;
  readonly category: FontCategory;
  readonly format: FontFileFormat;
  readonly coverage: FontCoverage;
  readonly variable: boolean;
  readonly embeddingRestrictions?: number;
}

interface TableRecord {
  readonly offset: number;
  readonly length: number;
}

interface NameRecord {
  readonly platformId: number;
  readonly encodingId: number;
  readonly languageId: number;
  readonly nameId: number;
  readonly value: string;
}

function requireRange(
  bytes: Uint8Array,
  offset: number,
  length: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > bytes.byteLength
  ) {
    throw new FontParseError("invalid-font", `${label} 超出字体文件范围。`);
  }
}

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function tag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function decodeUtf16Be(bytes: Uint8Array): string {
  const codeUnits: number[] = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    codeUnits.push(((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0));
  }
  return String.fromCharCode(...codeUnits);
}

function decodeSingleByte(bytes: Uint8Array): string {
  // Hermes only guarantees UTF-8 support in TextDecoder. SFNT name tables can
  // also contain legacy single-byte records, so decode those records directly
  // instead of asking the runtime for the optional "latin1" codec. Unicode
  // name records remain preferred below; this path is primarily an ASCII-safe
  // fallback for older fonts.
  const chunkSize = 4_096;
  let value = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    const codeUnits: number[] = [];
    for (let index = offset; index < end; index += 1) {
      codeUnits.push(bytes[index] ?? 0);
    }
    value += String.fromCharCode(...codeUnits);
  }
  return value;
}

function decodeName(
  bytes: Uint8Array,
  platformId: number,
  _encodingId: number,
): string {
  const value =
    platformId === 0 || platformId === 3
      ? decodeUtf16Be(bytes)
      : decodeSingleByte(bytes);
  return value.replaceAll("\u0000", "").trim();
}

function tableRecords(bytes: Uint8Array): ReadonlyMap<string, TableRecord> {
  requireRange(bytes, 0, 12, "SFNT header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = tag(bytes, 0);
  if (signature === "ttcf" || signature === "wOFF" || signature === "wOF2") {
    throw new FontParseError(
      "unsupported-format",
      signature === "ttcf"
        ? "暂不支持 TTC/OTC 字体集合。"
        : "暂不支持 WOFF/WOFF2 用户字体。",
    );
  }
  if (
    signature !== "\u0000\u0001\u0000\u0000" &&
    signature !== "OTTO" &&
    signature !== "true" &&
    signature !== "typ1"
  ) {
    throw new FontParseError(
      "unsupported-format",
      "不是受支持的 TTF/OTF 字体。",
    );
  }
  const count = u16(view, 4);
  if (count === 0 || count > MAX_TABLES) {
    throw new FontParseError("invalid-font", "字体 table 数量无效。");
  }
  requireRange(bytes, 12, count * 16, "SFNT table directory");
  const records = new Map<string, TableRecord>();
  for (let index = 0; index < count; index += 1) {
    const recordOffset = 12 + index * 16;
    const tableTag = tag(bytes, recordOffset);
    const offset = u32(view, recordOffset + 8);
    const length = u32(view, recordOffset + 12);
    requireRange(bytes, offset, length, `SFNT table ${tableTag}`);
    records.set(tableTag, { offset, length });
  }
  return records;
}

function readNames(
  bytes: Uint8Array,
  table: TableRecord | undefined,
): readonly NameRecord[] {
  if (!table || table.length < 6) {
    return [];
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = u16(view, table.offset + 2);
  const stringOffset = u16(view, table.offset + 4);
  if (6 + count * 12 > table.length || stringOffset > table.length) {
    throw new FontParseError("invalid-font", "字体 name table 无效。");
  }
  const records: NameRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 6 + index * 12;
    const platformId = u16(view, record);
    const encodingId = u16(view, record + 2);
    const languageId = u16(view, record + 4);
    const nameId = u16(view, record + 6);
    const length = u16(view, record + 8);
    const offset = u16(view, record + 10);
    const start = table.offset + stringOffset + offset;
    requireRange(bytes, start, length, "字体 name 字符串");
    const value = decodeName(
      bytes.subarray(start, start + length),
      platformId,
      encodingId,
    );
    if (value) {
      records.push({
        platformId,
        encodingId,
        languageId,
        nameId,
        value,
      });
    }
  }
  return records;
}

function preferredName(
  records: readonly NameRecord[],
  ids: readonly number[],
): string | undefined {
  for (const id of ids) {
    const matches = records.filter((record) => record.nameId === id);
    const preferred =
      matches.find(
        (record) => record.platformId === 3 && record.languageId === 0x0409,
      ) ??
      matches.find((record) => record.platformId === 0) ??
      matches.find((record) => record.platformId === 3) ??
      matches[0];
    if (preferred) {
      return preferred.value;
    }
  }
  return undefined;
}

function inferCategory(
  familyName: string,
  os2: TableRecord | undefined,
  bytes: Uint8Array,
): FontCategory {
  const normalized = familyName.toLowerCase();
  if (
    /(^|[\s_-])(mono|monospace|code)([\s_-]|$)/.test(normalized) ||
    /等宽|等幅/.test(familyName)
  ) {
    return "mono";
  }
  if (
    /(sans|gothic|grotesk|hei)/.test(normalized) ||
    /黑体|雅黑|圆体/.test(familyName)
  ) {
    return "sans";
  }
  if (
    /(serif|song|ming|mincho|roman)/.test(normalized) ||
    /宋体|明朝|仿宋|楷体/.test(familyName)
  ) {
    return "serif";
  }
  if (os2 && os2.length >= 42) {
    const serifStyle = bytes[os2.offset + 33] ?? 0;
    if (serifStyle >= 2 && serifStyle <= 10) {
      return "serif";
    }
    if (serifStyle >= 11 && serifStyle <= 15) {
      return "sans";
    }
  }
  return "unknown";
}

function cmapContains(
  bytes: Uint8Array,
  table: TableRecord | undefined,
  codePoint: number,
): boolean {
  if (!table || table.length < 4) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = u16(view, table.offset + 2);
  if (4 + count * 8 > table.length) {
    return false;
  }
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 4 + index * 8;
    const subtableOffset = u32(view, record + 4);
    if (subtableOffset + 2 > table.length) {
      continue;
    }
    const subtable = table.offset + subtableOffset;
    const format = u16(view, subtable);
    if (format === 12 && subtableOffset + 16 <= table.length) {
      const length = u32(view, subtable + 4);
      const groups = u32(view, subtable + 12);
      if (
        length < 16 ||
        subtableOffset + length > table.length ||
        16 + groups * 12 > length
      ) {
        continue;
      }
      let low = 0;
      let high = groups - 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const group = subtable + 16 + middle * 12;
        const start = u32(view, group);
        const end = u32(view, group + 4);
        if (codePoint < start) {
          high = middle - 1;
        } else if (codePoint > end) {
          low = middle + 1;
        } else {
          return true;
        }
      }
    } else if (format === 4 && codePoint <= 0xffff) {
      if (subtableOffset + 14 > table.length) {
        continue;
      }
      const length = u16(view, subtable + 2);
      const segmentCount = u16(view, subtable + 6) / 2;
      if (
        length < 16 ||
        subtableOffset + length > table.length ||
        14 + segmentCount * 8 + 2 > length
      ) {
        continue;
      }
      const endCodes = subtable + 14;
      const startCodes = endCodes + segmentCount * 2 + 2;
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const end = u16(view, endCodes + segment * 2);
        const start = u16(view, startCodes + segment * 2);
        if (codePoint >= start && codePoint <= end) {
          return true;
        }
      }
    }
  }
  return false;
}

function coverageOf(
  bytes: Uint8Array,
  cmap: TableRecord | undefined,
): FontCoverage {
  return {
    latin: cmapContains(bytes, cmap, 0x0041),
    cjk: cmapContains(bytes, cmap, 0x4e2d) || cmapContains(bytes, cmap, 0x56fd),
    math:
      cmapContains(bytes, cmap, 0x2211) || cmapContains(bytes, cmap, 0x222b),
    emoji:
      cmapContains(bytes, cmap, 0x1f600) || cmapContains(bytes, cmap, 0x2764),
  };
}

export function parseSfntFont(bytes: Uint8Array): ParsedFontMetadata {
  if (bytes.byteLength === 0) {
    throw new FontParseError("empty-font", "字体文件为空。");
  }
  if (bytes.byteLength > MAX_USER_FONT_BYTES) {
    throw new FontParseError(
      "font-too-large",
      `字体文件不能超过 ${MAX_USER_FONT_BYTES / 1024 / 1024} MB。`,
    );
  }
  const tables = tableRecords(bytes);
  const names = readNames(bytes, tables.get("name"));
  const familyName = preferredName(names, [16, 1]);
  if (!familyName) {
    throw new FontParseError("invalid-font", "字体缺少有效的 family 名称。");
  }
  const subfamilyName = preferredName(names, [17, 2]);
  const postscriptName = preferredName(names, [6]);
  const os2 = tables.get("OS/2");
  const head = tables.get("head");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rawWeight = os2 && os2.length >= 6 ? u16(view, os2.offset + 4) : 400;
  const embeddingRestrictions =
    os2 && os2.length >= 10 ? u16(view, os2.offset + 8) : undefined;
  const macStyle = head && head.length >= 46 ? u16(view, head.offset + 44) : 0;
  const italicByName = /italic|oblique|斜体/i.test(subfamilyName ?? "");
  const style: FontFaceStyle =
    italicByName || (macStyle & 0x0002) !== 0 ? "italic" : "normal";

  return {
    familyName,
    ...(subfamilyName ? { subfamilyName } : {}),
    ...(postscriptName ? { postscriptName } : {}),
    weight: normalizeFontWeight(rawWeight),
    style,
    category: inferCategory(familyName, os2, bytes),
    format: tag(bytes, 0) === "OTTO" ? "otf" : "ttf",
    coverage: coverageOf(bytes, tables.get("cmap")),
    variable: tables.has("fvar"),
    ...(embeddingRestrictions !== undefined ? { embeddingRestrictions } : {}),
  };
}
