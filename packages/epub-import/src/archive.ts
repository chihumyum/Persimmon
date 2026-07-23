import { unzipSync } from "fflate";

import { EpubImportError } from "./errors";

const MEBIBYTE = 1024 * 1024;

export interface EpubArchiveLimits {
  maxInputBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxExtractedBytes: number;
}

export const DEFAULT_EPUB_ARCHIVE_LIMITS: Readonly<EpubArchiveLimits> = {
  maxInputBytes: 50 * MEBIBYTE,
  maxEntries: 2_000,
  maxEntryBytes: 32 * MEBIBYTE,
  maxExtractedBytes: 256 * MEBIBYTE,
};

export interface OpenEpubArchiveOptions {
  limits?: Partial<EpubArchiveLimits>;
}

function mergeLimits(
  overrides: Partial<EpubArchiveLimits> | undefined,
): EpubArchiveLimits {
  const limits = {
    ...DEFAULT_EPUB_ARCHIVE_LIMITS,
    ...overrides,
  };

  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new EpubImportError(
        "invalid-input",
        `${name} must be a positive safe integer`,
      );
    }
  }

  return limits;
}

function decodePathSegment(segment: string, context: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch (error) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Archive path contains invalid percent encoding: ${context}`,
      context,
      { cause: error },
    );
  }

  if (
    decoded === "." ||
    decoded === ".." ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    decoded.includes("\0")
  ) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Archive path contains an unsafe segment: ${context}`,
      context,
    );
  }

  return decoded;
}

function validateArchiveEntryName(name: string): string {
  if (
    name.length === 0 ||
    name.startsWith("/") ||
    name.startsWith("\\") ||
    name.includes("\\") ||
    name.includes("\0") ||
    /^[A-Za-z]:/.test(name)
  ) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Archive entry has an unsafe path: ${name}`,
      name,
    );
  }

  const isDirectory = name.endsWith("/");
  const path = isDirectory ? name.slice(0, -1) : name;
  if (path.length === 0) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Archive entry has an empty path: ${name}`,
      name,
    );
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Archive entry has an empty path segment: ${name}`,
      name,
    );
  }

  for (const segment of segments) {
    decodePathSegment(segment, name);
  }

  return path;
}

function referencePath(reference: string): string {
  const fragmentIndex = reference.indexOf("#");
  const withoutFragment =
    fragmentIndex === -1 ? reference : reference.slice(0, fragmentIndex);
  const queryIndex = withoutFragment.indexOf("?");
  return queryIndex === -1
    ? withoutFragment
    : withoutFragment.slice(0, queryIndex);
}

export function resolveArchiveReference(
  baseDocumentPath: string,
  reference: string,
): string {
  const path = referencePath(reference.trim());

  if (path.length === 0) {
    return baseDocumentPath;
  }

  if (
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path) ||
    path.startsWith("//")
  ) {
    throw new EpubImportError(
      "unsupported-external-resource",
      `External resources are not supported: ${reference}`,
      reference,
    );
  }

  if (
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Resource reference has an unsafe path: ${reference}`,
      reference,
    );
  }

  const output = baseDocumentPath.length
    ? baseDocumentPath.split("/").slice(0, -1)
    : [];

  for (const rawSegment of path.split("/")) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch (error) {
      throw new EpubImportError(
        "unsafe-archive-path",
        `Resource reference contains invalid percent encoding: ${reference}`,
        reference,
        { cause: error },
      );
    }

    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (output.length === 0) {
        throw new EpubImportError(
          "unsafe-archive-path",
          `Resource reference escapes the EPUB root: ${reference}`,
          reference,
        );
      }
      output.pop();
      continue;
    }

    if (
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      throw new EpubImportError(
        "unsafe-archive-path",
        `Resource reference contains an encoded path separator: ${reference}`,
        reference,
      );
    }

    output.push(segment);
  }

  if (output.length === 0) {
    throw new EpubImportError(
      "unsafe-archive-path",
      `Resource reference does not resolve to a file: ${reference}`,
      reference,
    );
  }

  return output.join("/");
}

export class EpubArchive {
  readonly entries: ReadonlyMap<string, Uint8Array>;

  private constructor(entries: ReadonlyMap<string, Uint8Array>) {
    this.entries = entries;
  }

  static open(
    bytes: Uint8Array,
    options: OpenEpubArchiveOptions = {},
  ): EpubArchive {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      throw new EpubImportError(
        "invalid-input",
        "EPUB input must be a non-empty Uint8Array",
      );
    }

    const limits = mergeLimits(options.limits);
    if (bytes.byteLength > limits.maxInputBytes) {
      throw new EpubImportError(
        "archive-limit-exceeded",
        `EPUB input exceeds ${limits.maxInputBytes} bytes`,
      );
    }

    let entryCount = 0;
    let declaredExtractedBytes = 0;
    const seen = new Set<string>();
    let unzipped: Record<string, Uint8Array>;

    try {
      unzipped = unzipSync(bytes, {
        filter(file) {
          entryCount += 1;
          if (entryCount > limits.maxEntries) {
            throw new EpubImportError(
              "archive-limit-exceeded",
              `EPUB contains more than ${limits.maxEntries} entries`,
            );
          }

          const canonicalPath = validateArchiveEntryName(file.name);
          if (seen.has(canonicalPath)) {
            throw new EpubImportError(
              "unsafe-archive-path",
              `EPUB contains duplicate archive path: ${canonicalPath}`,
              canonicalPath,
            );
          }
          seen.add(canonicalPath);

          if (file.originalSize > limits.maxEntryBytes) {
            throw new EpubImportError(
              "archive-limit-exceeded",
              `Archive entry exceeds ${limits.maxEntryBytes} bytes: ${file.name}`,
              file.name,
            );
          }

          declaredExtractedBytes += file.originalSize;
          if (declaredExtractedBytes > limits.maxExtractedBytes) {
            throw new EpubImportError(
              "archive-limit-exceeded",
              `EPUB expands beyond ${limits.maxExtractedBytes} bytes`,
            );
          }

          return !file.name.endsWith("/");
        },
      });
    } catch (error) {
      if (error instanceof EpubImportError) {
        throw error;
      }
      throw new EpubImportError(
        "invalid-archive",
        "EPUB is not a supported ZIP archive",
        undefined,
        { cause: error },
      );
    }

    let actualExtractedBytes = 0;
    const entries = new Map<string, Uint8Array>();
    for (const [name, data] of Object.entries(unzipped)) {
      const canonicalPath = validateArchiveEntryName(name);
      actualExtractedBytes += data.byteLength;
      if (actualExtractedBytes > limits.maxExtractedBytes) {
        throw new EpubImportError(
          "archive-limit-exceeded",
          `EPUB expands beyond ${limits.maxExtractedBytes} bytes`,
        );
      }
      entries.set(canonicalPath, data);
    }

    return new EpubArchive(entries);
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  read(path: string): Uint8Array | undefined {
    return this.entries.get(path);
  }
}

