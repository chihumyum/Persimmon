import {
  FONT_CATALOG_SCHEMA_VERSION,
  type DownloadableFontCatalog,
  type DownloadableFontFamily,
  type FontCategory,
  type FontFaceStyle,
  type FontFileFormat,
} from "./model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCategory(value: unknown): value is FontCategory {
  return (
    value === "serif" ||
    value === "sans" ||
    value === "mono" ||
    value === "display" ||
    value === "unknown"
  );
}

function isStyle(value: unknown): value is FontFaceStyle {
  return value === "normal" || value === "italic";
}

function isFormat(value: unknown): value is FontFileFormat {
  return value === "ttf" || value === "otf";
}

function parseFamily(value: unknown): DownloadableFontFamily | undefined {
  if (
    !isRecord(value) ||
    !nonEmptyString(value.id) ||
    !nonEmptyString(value.displayName) ||
    !isCategory(value.category) ||
    !isRecord(value.license) ||
    !nonEmptyString(value.license.name) ||
    typeof value.license.redistributable !== "boolean" ||
    !Array.isArray(value.faces) ||
    value.faces.length === 0
  ) {
    return undefined;
  }
  const faces = value.faces.flatMap((face) => {
    if (
      !isRecord(face) ||
      !nonEmptyString(face.id) ||
      !isStyle(face.style) ||
      !isFormat(face.format) ||
      !nonEmptyString(face.url) ||
      !/^https:\/\//i.test(face.url) ||
      !nonEmptyString(face.sha256) ||
      !/^[a-f0-9]{64}$/i.test(face.sha256) ||
      typeof face.weight !== "number" ||
      !Number.isInteger(face.weight) ||
      face.weight < 100 ||
      face.weight > 900 ||
      face.weight % 100 !== 0 ||
      typeof face.byteLength !== "number" ||
      !Number.isSafeInteger(face.byteLength) ||
      face.byteLength <= 0
    ) {
      return [];
    }
    return [
      {
        id: face.id,
        weight: face.weight,
        style: face.style,
        format: face.format,
        url: face.url,
        sha256: face.sha256.toLowerCase(),
        byteLength: face.byteLength,
      },
    ];
  });
  if (faces.length !== value.faces.length) {
    return undefined;
  }
  return {
    id: value.id,
    displayName: value.displayName,
    category: value.category,
    ...(nonEmptyString(value.description)
      ? { description: value.description }
      : {}),
    license: {
      name: value.license.name,
      ...(nonEmptyString(value.license.url) ? { url: value.license.url } : {}),
      redistributable: value.license.redistributable,
    },
    faces,
  };
}

export function parseDownloadableFontCatalog(
  value: unknown,
): DownloadableFontCatalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== FONT_CATALOG_SCHEMA_VERSION ||
    !Array.isArray(value.families)
  ) {
    throw new Error("字体目录格式无效。");
  }
  const families = value.families.map(parseFamily);
  if (families.some((family) => family === undefined)) {
    throw new Error("字体目录包含无效字体记录。");
  }
  const resolved = families as DownloadableFontFamily[];
  if (new Set(resolved.map((family) => family.id)).size !== resolved.length) {
    throw new Error("字体目录包含重复 family ID。");
  }
  const faceIds = resolved.flatMap((family) =>
    family.faces.map((face) => face.id),
  );
  if (new Set(faceIds).size !== faceIds.length) {
    throw new Error("字体目录包含重复 face ID。");
  }
  return {
    schemaVersion: FONT_CATALOG_SCHEMA_VERSION,
    families: resolved,
  };
}
