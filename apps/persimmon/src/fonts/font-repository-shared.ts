import {
  FONT_REPOSITORY_SCHEMA_VERSION,
  FontParseError,
  MAX_USER_FONT_BYTES,
  normalizeFontWeight,
  parseSfntFont,
  type FontFaceRecord,
  type FontFamilyRecord,
  type FontRepositorySnapshot,
} from "@persimmon/font-core";

import { sha256Hex } from "../library/shared";
import { BUILTIN_FONT_FAMILIES } from "./builtin-fonts";
import { FontRepositoryError, type InstallFontInput } from "./types";

function safeId(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "font";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredFamily(value: unknown): value is FontFamilyRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.startsWith("builtin:") ||
    typeof value.displayName !== "string" ||
    (value.source !== "downloaded" && value.source !== "user") ||
    !["serif", "sans", "mono", "display", "unknown"].includes(
      String(value.category),
    ) ||
    !Array.isArray(value.faces) ||
    value.faces.length === 0
  ) {
    return false;
  }
  const validFaces = value.faces.every(
    (face) =>
      isRecord(face) &&
      typeof face.id === "string" &&
      typeof face.familyId === "string" &&
      face.familyId === value.id &&
      typeof face.storageKey === "string" &&
      typeof face.sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(face.sha256) &&
      face.storageKey === `${face.sha256}.${face.format}` &&
      typeof face.byteLength === "number" &&
      Number.isSafeInteger(face.byteLength) &&
      face.byteLength > 0 &&
      face.byteLength <= MAX_USER_FONT_BYTES &&
      typeof face.weight === "number" &&
      Number.isInteger(face.weight) &&
      face.weight >= 100 &&
      face.weight <= 900 &&
      face.weight % 100 === 0 &&
      (face.style === "normal" || face.style === "italic") &&
      (face.format === "ttf" || face.format === "otf") &&
      isRecord(face.coverage) &&
      typeof face.coverage.latin === "boolean" &&
      typeof face.coverage.cjk === "boolean" &&
      typeof face.coverage.math === "boolean" &&
      typeof face.coverage.emoji === "boolean" &&
      typeof face.variable === "boolean",
  );
  return (
    validFaces &&
    new Set(
      value.faces.flatMap((face) =>
        isRecord(face) && typeof face.id === "string" ? [face.id] : [],
      ),
    ).size === value.faces.length
  );
}

export function parseStoredFontSnapshot(
  value: unknown,
): FontRepositorySnapshot {
  if (
    !isRecord(value) ||
    value.schemaVersion !== FONT_REPOSITORY_SCHEMA_VERSION ||
    !Array.isArray(value.families)
  ) {
    return {
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: [],
    };
  }
  const families = value.families.filter(isStoredFamily);
  return {
    schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
    families: families.filter(
      (family, index) =>
        families.findIndex((candidate) => candidate.id === family.id) === index,
    ),
  };
}

export function allFontFamilies(
  snapshot: FontRepositorySnapshot,
): readonly FontFamilyRecord[] {
  return [...BUILTIN_FONT_FAMILIES, ...snapshot.families];
}

export async function prepareFontInstall(input: InstallFontInput): Promise<{
  readonly family: FontFamilyRecord;
  readonly face: FontFaceRecord;
  readonly replacedStorageKeys: readonly string[];
}> {
  if (
    input.expectedByteLength !== undefined &&
    input.bytes.byteLength !== input.expectedByteLength
  ) {
    throw new FontRepositoryError(
      "integrity-mismatch",
      "字体下载大小与目录记录不一致。",
    );
  }
  let metadata;
  try {
    metadata = parseSfntFont(input.bytes);
  } catch (error) {
    if (error instanceof FontParseError) {
      throw new FontRepositoryError("invalid-font", error.message, {
        cause: error,
      });
    }
    throw error;
  }
  const digest = await sha256Hex(input.bytes);
  if (input.expectedSha256 && digest !== input.expectedSha256.toLowerCase()) {
    throw new FontRepositoryError(
      "integrity-mismatch",
      "字体文件校验失败，下载内容可能已被替换。",
    );
  }
  const familyId =
    input.familyId ?? `${input.source}:${safeId(metadata.familyName)}`;
  if (familyId.startsWith("builtin:")) {
    throw new FontRepositoryError("invalid-font", "外部字体不能覆盖内置字体。");
  }
  const faceId =
    input.faceId ??
    `${familyId}:${normalizeFontWeight(metadata.weight)}:${metadata.style}`;
  const storageKey = `${digest}.${metadata.format}`;
  const face: FontFaceRecord = {
    id: faceId,
    familyId,
    ...(metadata.postscriptName
      ? { postscriptName: metadata.postscriptName }
      : {}),
    weight: metadata.weight,
    style: metadata.style,
    format: metadata.format,
    sha256: digest,
    byteLength: input.bytes.byteLength,
    storageKey,
    coverage: metadata.coverage,
    variable: metadata.variable,
    ...(metadata.embeddingRestrictions !== undefined
      ? { embeddingRestrictions: metadata.embeddingRestrictions }
      : {}),
  };
  return {
    family: {
      id: familyId,
      displayName: input.displayName ?? metadata.familyName,
      source: input.source,
      category: metadata.category,
      faces: [face],
      ...(input.license ? { license: input.license } : {}),
    },
    face,
    replacedStorageKeys: [],
  };
}

export function mergeInstalledFamily(
  snapshot: FontRepositorySnapshot,
  incoming: FontFamilyRecord,
): {
  readonly snapshot: FontRepositorySnapshot;
  readonly family: FontFamilyRecord;
  readonly replacedStorageKeys: readonly string[];
} {
  const existing = snapshot.families.find(
    (family) => family.id === incoming.id,
  );
  const incomingFace = incoming.faces[0];
  if (!incomingFace) {
    throw new FontRepositoryError("invalid-font", "字体没有可安装的 face。");
  }
  const replaced = existing?.faces.filter(
    (face) =>
      face.id === incomingFace.id ||
      (face.weight === incomingFace.weight &&
        face.style === incomingFace.style),
  );
  const retained =
    existing?.faces.filter((face) => !replaced?.includes(face)) ?? [];
  const family: FontFamilyRecord = {
    ...incoming,
    displayName: incoming.displayName || existing?.displayName || incoming.id,
    category:
      incoming.category === "unknown"
        ? (existing?.category ?? "unknown")
        : incoming.category,
    faces: [...retained, incomingFace].sort(
      (left, right) =>
        left.weight - right.weight || left.style.localeCompare(right.style),
    ),
    ...(incoming.license || existing?.license
      ? { license: incoming.license ?? existing?.license }
      : {}),
  };
  return {
    family,
    snapshot: {
      schemaVersion: FONT_REPOSITORY_SCHEMA_VERSION,
      families: [
        ...snapshot.families.filter((item) => item.id !== family.id),
        family,
      ].sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      ),
    },
    replacedStorageKeys:
      replaced?.flatMap((face) => (face.storageKey ? [face.storageKey] : [])) ??
      [],
  };
}
