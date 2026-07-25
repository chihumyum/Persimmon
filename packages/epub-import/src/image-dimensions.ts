import type { Size } from "@persimmon/book-core";
import { strFromU8 } from "fflate";

function positiveSize(width: number, height: number): Size | undefined {
  return Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? { width, height }
    : undefined;
}

function uint16BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function uint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function uint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngSize(bytes: Uint8Array): Size | undefined {
  if (
    bytes.length < 24 ||
    ascii(bytes, 1, 3) !== "PNG" ||
    ascii(bytes, 12, 4) !== "IHDR"
  ) {
    return undefined;
  }
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + 16,
    Math.min(8, bytes.byteLength - 16),
  );
  return positiveSize(view.getUint32(0), view.getUint32(4));
}

function gifSize(bytes: Uint8Array): Size | undefined {
  if (bytes.length < 10 || !ascii(bytes, 0, 6).startsWith("GIF8")) {
    return undefined;
  }
  return positiveSize(
    uint16LittleEndian(bytes, 6),
    uint16LittleEndian(bytes, 8),
  );
}

const JPEG_SIZE_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(bytes: Uint8Array): Size | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      return undefined;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      return undefined;
    }
    const segmentLength = uint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return undefined;
    }
    if (JPEG_SIZE_MARKERS.has(marker) && segmentLength >= 7) {
      return positiveSize(
        uint16BigEndian(bytes, offset + 5),
        uint16BigEndian(bytes, offset + 3),
      );
    }
    offset += segmentLength;
  }
  return undefined;
}

function webpSize(bytes: Uint8Array): Size | undefined {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return undefined;
  }

  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.length >= 30) {
    return positiveSize(
      uint24LittleEndian(bytes, 24) + 1,
      uint24LittleEndian(bytes, 27) + 1,
    );
  }
  if (
    chunk === "VP8 " &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return positiveSize(
      uint16LittleEndian(bytes, 26) & 0x3fff,
      uint16LittleEndian(bytes, 28) & 0x3fff,
    );
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const first = bytes[21]!;
    const second = bytes[22]!;
    const third = bytes[23]!;
    const fourth = bytes[24]!;
    return positiveSize(
      1 + first + ((second & 0x3f) << 8),
      1 + (second >> 6) + (third << 2) + ((fourth & 0x0f) << 10),
    );
  }
  return undefined;
}

function svgSize(bytes: Uint8Array): Size | undefined {
  const source = strFromU8(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const svg = source.match(/<svg\b[^>]*>/i)?.[0];
  if (!svg) {
    return undefined;
  }
  const length = (name: string): number | undefined => {
    const raw = svg
      .match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]
      ?.trim();
    const match = raw?.match(/^([0-9]+(?:\.[0-9]+)?)(?:px)?$/i);
    return match ? Number(match[1]) : undefined;
  };
  const width = length("width");
  const height = length("height");
  if (width && height) {
    return positiveSize(width, height);
  }
  const viewBox = svg
    .match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  return viewBox?.length === 4
    ? positiveSize(viewBox[2]!, viewBox[3]!)
    : undefined;
}

export function detectImageSize(
  bytes: Uint8Array,
  mediaType: string,
): Size | undefined {
  switch (mediaType.toLowerCase().split(";")[0]) {
    case "image/png":
      return pngSize(bytes);
    case "image/jpeg":
    case "image/jpg":
      return jpegSize(bytes);
    case "image/gif":
      return gifSize(bytes);
    case "image/webp":
      return webpSize(bytes);
    case "image/svg+xml":
      return svgSize(bytes);
    default:
      return undefined;
  }
}
