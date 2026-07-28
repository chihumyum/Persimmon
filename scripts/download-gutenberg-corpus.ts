import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { gunzipSync } from "node:zlib";

const CATALOG_URL =
  "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz";
const DEFAULT_MIRROR_BASE = "https://mirror.cs.odu.edu/gutenberg-epub";
const DEFAULT_TITLE_COUNT = 500;
const DEFAULT_CONCURRENCY = 4;
const MANIFEST_SCHEMA_VERSION = 1;

const LANGUAGE_WEIGHTS = new Map<string, number>([
  ["en", 193],
  ["fr", 45],
  ["de", 40],
  ["es", 30],
  ["it", 25],
  ["pt", 20],
  ["nl", 20],
  ["fi", 20],
  ["zh", 20],
  ["sv", 15],
  ["da", 10],
  ["no", 10],
  ["pl", 10],
  ["hu", 10],
  ["ja", 10],
  ["he", 6],
  ["ru", 5],
  ["el", 5],
  ["la", 5],
  ["ar", 1],
]);

type EpubVariant = "epub2-images" | "epub3-images";

interface CliOptions {
  readonly root: string;
  readonly titleCount: number;
  readonly concurrency: number;
  readonly mirrorBase: string;
}

interface CatalogRecord {
  readonly id: number;
  readonly type: string;
  readonly issued: string;
  readonly title: string;
  readonly language: string;
  readonly authors: string;
  readonly subjects: string;
}

interface CorpusItem {
  readonly id: number;
  readonly language: string;
  readonly title: string;
  readonly authors: string;
  readonly issued: string;
  readonly subjects: string;
  readonly variant: EpubVariant;
  readonly sourceUrl: string;
  readonly relativePath: string;
  readonly paired: boolean;
}

interface CorpusManifest {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly catalog: {
    readonly url: string;
    readonly relativePath: string;
    readonly sha256: string;
  };
  readonly mirrorBase: string;
  readonly selection: {
    readonly requestedTitles: number;
    readonly selectedTitles: number;
    readonly files: number;
    readonly method: string;
    readonly languageTargets: Readonly<Record<string, number>>;
    readonly languageCounts: Readonly<Record<string, number>>;
    readonly pairedTitleCount: number;
  };
  readonly items: readonly CorpusItem[];
}

interface DownloadResult {
  readonly relativePath: string;
  readonly status: "downloaded" | "existing" | "failed";
  readonly bytes?: number;
  readonly sha256?: string;
  readonly error?: string;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}"`);
  }
  return parsed;
}

function cliOptions(): CliOptions {
  const root =
    argumentValue("--root") ?? process.env.PERSIMMON_EPUB_CORPUS_ROOT;
  if (!root) {
    throw new Error(
      "Missing corpus root. Pass --root <directory> or set PERSIMMON_EPUB_CORPUS_ROOT.",
    );
  }
  return {
    root,
    titleCount: positiveInteger(argumentValue("--titles"), DEFAULT_TITLE_COUNT),
    concurrency: positiveInteger(
      argumentValue("--concurrency"),
      DEFAULT_CONCURRENCY,
    ),
    mirrorBase: (argumentValue("--mirror") ?? DEFAULT_MIRROR_BASE).replace(
      /\/+$/,
      "",
    ),
  };
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("Catalog CSV ends inside a quoted field");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function catalogRecords(csv: string): CatalogRecord[] {
  const rows = parseCsv(csv);
  const header = rows.shift();
  if (!header) {
    throw new Error("Catalog CSV is empty");
  }
  const index = new Map(header.map((name, position) => [name, position]));
  const value = (row: readonly string[], name: string): string =>
    row[index.get(name) ?? -1] ?? "";

  return rows.flatMap((row) => {
    const id = Number.parseInt(value(row, "Text#"), 10);
    if (!Number.isSafeInteger(id)) {
      return [];
    }
    return [
      {
        id,
        type: value(row, "Type"),
        issued: value(row, "Issued"),
        title: value(row, "Title").replace(/\s+/g, " ").trim(),
        language: value(row, "Language")
          .split(/[;,]/u)[0]
          ?.trim()
          .toLowerCase(),
        authors: value(row, "Authors").replace(/\s+/g, " ").trim(),
        subjects: value(row, "Subjects").replace(/\s+/g, " ").trim(),
      },
    ];
  });
}

function stableNumber(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function scaledLanguageTargets(titleCount: number): Map<string, number> {
  const defaultTotal = [...LANGUAGE_WEIGHTS.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const exact = [...LANGUAGE_WEIGHTS].map(([language, weight]) => ({
    language,
    exact: (weight * titleCount) / defaultTotal,
  }));
  const targets = new Map(
    exact.map(({ language, exact: count }) => [language, Math.floor(count)]),
  );
  let remaining =
    titleCount - [...targets.values()].reduce((sum, count) => sum + count, 0);
  exact
    .sort(
      (left, right) =>
        right.exact -
          Math.floor(right.exact) -
          (left.exact - Math.floor(left.exact)) ||
        left.language.localeCompare(right.language),
    )
    .slice(0, remaining)
    .forEach(({ language }) => {
      targets.set(language, (targets.get(language) ?? 0) + 1);
      remaining -= 1;
    });
  return targets;
}

function sampleAcrossIdRange(
  records: readonly CatalogRecord[],
  count: number,
  seed: string,
): CatalogRecord[] {
  if (count > records.length) {
    throw new Error(
      `Cannot select ${count} records from a population of ${records.length}`,
    );
  }
  const sorted = [...records].sort((left, right) => left.id - right.id);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * sorted.length) / count);
    const end = Math.floor(((index + 1) * sorted.length) / count);
    const width = Math.max(1, end - start);
    const offset = stableNumber(`${seed}:${index}`) % width;
    return sorted[start + offset] as CatalogRecord;
  });
}

function selectRecords(
  records: readonly CatalogRecord[],
  titleCount: number,
): {
  selected: CatalogRecord[];
  targets: Map<string, number>;
  counts: Map<string, number>;
} {
  const textRecords = records.filter(
    (record) => record.type === "Text" && record.language.length > 0,
  );
  const byLanguage = new Map<string, CatalogRecord[]>();
  for (const record of textRecords) {
    const bucket = byLanguage.get(record.language) ?? [];
    bucket.push(record);
    byLanguage.set(record.language, bucket);
  }

  const targets = scaledLanguageTargets(titleCount);
  const selected: CatalogRecord[] = [];
  const counts = new Map<string, number>();
  let deficit = 0;
  for (const [language, target] of targets) {
    const candidates = byLanguage.get(language) ?? [];
    const count = Math.min(target, candidates.length);
    selected.push(...sampleAcrossIdRange(candidates, count, language));
    counts.set(language, count);
    deficit += target - count;
  }

  if (deficit > 0) {
    const selectedIds = new Set(selected.map((record) => record.id));
    const fillCandidates = textRecords.filter(
      (record) => !selectedIds.has(record.id),
    );
    for (const record of sampleAcrossIdRange(
      fillCandidates,
      deficit,
      "language-deficit",
    )) {
      selected.push(record);
      counts.set(record.language, (counts.get(record.language) ?? 0) + 1);
    }
  }

  return {
    selected: selected.sort((left, right) => left.id - right.id),
    targets,
    counts,
  };
}

function filename(id: number, variant: EpubVariant): string {
  return variant === "epub3-images"
    ? `pg${id}-images-3.epub`
    : `pg${id}-images.epub`;
}

function corpusItems(
  records: readonly CatalogRecord[],
  mirrorBase: string,
): CorpusItem[] {
  return records.flatMap((record, index) => {
    const primaryVariant: EpubVariant =
      stableNumber(`variant:${record.id}`) % 3 === 0
        ? "epub2-images"
        : "epub3-images";
    const variants: EpubVariant[] =
      index % 10 === 0 ? ["epub2-images", "epub3-images"] : [primaryVariant];
    return variants.map((variant) => {
      const epubFilename = filename(record.id, variant);
      return {
        id: record.id,
        language: record.language,
        title: record.title,
        authors: record.authors,
        issued: record.issued,
        subjects: record.subjects,
        variant,
        sourceUrl: `${mirrorBase}/${record.id}/${epubFilename}`,
        relativePath: join(
          "books",
          record.language,
          String(record.id),
          epubFilename,
        ),
        paired: variants.length === 2,
      };
    });
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

async function hasZipEnvelope(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    if (fileStat.size < 22) {
      return false;
    }
    const handle = await open(path, "r");
    try {
      const header = Buffer.alloc(4);
      const headerRead = await handle.read(header, 0, 4, 0);
      if (
        headerRead.bytesRead !== 4 ||
        !header.equals(Buffer.from("PK\u0003\u0004"))
      ) {
        return false;
      }

      const tailLength = Math.min(fileStat.size, 65_557);
      const tail = Buffer.alloc(tailLength);
      const tailRead = await handle.read(
        tail,
        0,
        tailLength,
        fileStat.size - tailLength,
      );
      for (let index = tailRead.bytesRead - 22; index >= 0; index -= 1) {
        if (
          tail[index] === 0x50 &&
          tail[index + 1] === 0x4b &&
          tail[index + 2] === 0x05 &&
          tail[index + 3] === 0x06
        ) {
          return true;
        }
      }
      return false;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

async function runCurl(
  url: string,
  output: string,
  resume: boolean,
): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  const arguments_ = [
    "--fail",
    "--location",
    "--retry",
    "5",
    "--retry-all-errors",
    "--retry-delay",
    "2",
    "--connect-timeout",
    "20",
    "--max-time",
    "600",
    ...(resume ? ["--continue-at", "-"] : []),
    "--output",
    output,
    url,
  ];
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("curl", arguments_, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(
          new Error(
            `curl exited with code ${String(code)} for ${url}: ${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

async function buildManifest(
  options: CliOptions,
  catalogPath: string,
): Promise<CorpusManifest> {
  const compressed = await readFile(catalogPath);
  const records = catalogRecords(gunzipSync(compressed).toString("utf8"));
  const { selected, targets, counts } = selectRecords(
    records,
    options.titleCount,
  );
  const items = corpusItems(selected, options.mirrorBase);
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    catalog: {
      url: CATALOG_URL,
      relativePath: relative(options.root, catalogPath),
      sha256: createHash("sha256").update(compressed).digest("hex"),
    },
    mirrorBase: options.mirrorBase,
    selection: {
      requestedTitles: options.titleCount,
      selectedTitles: selected.length,
      files: items.length,
      method:
        "Language quotas with deterministic sampling across each language's Gutenberg ID range; every tenth title includes paired EPUB 2 and EPUB 3 files.",
      languageTargets: Object.fromEntries(targets),
      languageCounts: Object.fromEntries(counts),
      pairedTitleCount: items.filter(
        (item, index) =>
          item.paired && (index === 0 || items[index - 1]?.id !== item.id),
      ).length,
    },
    items,
  };
}

async function loadOrCreateManifest(
  options: CliOptions,
  catalogPath: string,
  manifestPath: string,
): Promise<CorpusManifest> {
  if (await pathExists(manifestPath)) {
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as CorpusManifest;
    if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported existing manifest schema ${manifest.schemaVersion}`,
      );
    }
    console.log(
      `Resuming manifest with ${manifest.selection.selectedTitles} titles and ${manifest.items.length} files.`,
    );
    return manifest;
  }
  const manifest = await buildManifest(options, catalogPath);
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, undefined, 2)}\n`,
    "utf8",
  );
  return manifest;
}

async function downloadItem(
  root: string,
  item: CorpusItem,
): Promise<DownloadResult> {
  const destination = join(root, item.relativePath);
  if (await hasZipEnvelope(destination)) {
    const fileStat = await stat(destination);
    return {
      relativePath: item.relativePath,
      status: "existing",
      bytes: fileStat.size,
      sha256: await sha256(destination),
    };
  }
  if (await pathExists(destination)) {
    await rename(
      destination,
      `${destination}.invalid-${new Date().toISOString().replaceAll(":", "-")}`,
    );
  }

  const partial = `${destination}.part`;
  try {
    try {
      await runCurl(item.sourceUrl, partial, true);
    } catch (error) {
      if (!(await hasZipEnvelope(partial))) {
        throw error;
      }
    }
    if (!(await hasZipEnvelope(partial))) {
      throw new Error("Downloaded file is not a complete ZIP archive");
    }
    await rename(partial, destination);
    const fileStat = await stat(destination);
    return {
      relativePath: item.relativePath,
      status: "downloaded",
      bytes: fileStat.size,
      sha256: await sha256(destination),
    };
  } catch (error) {
    return {
      relativePath: item.relativePath,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function downloadAll(
  root: string,
  items: readonly CorpusItem[],
  concurrency: number,
): Promise<DownloadResult[]> {
  const results = new Array<DownloadResult>(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await downloadItem(root, items[index] as CorpusItem);
      completed += 1;
      if (
        completed === 1 ||
        completed % 10 === 0 ||
        completed === items.length
      ) {
        const failures = results
          .slice(0, completed)
          .filter((result) => result?.status === "failed").length;
        console.log(
          `Downloaded/verified ${completed}/${items.length}; failures: ${failures}`,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () =>
      worker(),
    ),
  );
  return results;
}

async function main(): Promise<void> {
  const options = cliOptions();
  const catalogPath = join(options.root, "catalog", basename(CATALOG_URL));
  const manifestPath = join(options.root, "manifest.json");
  const reportPath = join(options.root, "download-report.json");

  await mkdir(join(options.root, "catalog"), { recursive: true });
  await mkdir(join(options.root, "books"), { recursive: true });
  if (!(await pathExists(catalogPath))) {
    console.log(`Downloading Project Gutenberg catalog to ${catalogPath}`);
    await runCurl(CATALOG_URL, catalogPath, true);
  }

  const manifest = await loadOrCreateManifest(
    options,
    catalogPath,
    manifestPath,
  );
  console.log(
    `Corpus root: ${options.root}\nMirror: ${manifest.mirrorBase}\nFiles: ${manifest.items.length}, concurrency: ${options.concurrency}`,
  );
  const startedAt = Date.now();
  const results = await downloadAll(
    options.root,
    manifest.items,
    options.concurrency,
  );
  const failures = results.filter((result) => result.status === "failed");
  const report = {
    schemaVersion: 1,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    downloaded: results.filter((result) => result.status === "downloaded")
      .length,
    existing: results.filter((result) => result.status === "existing").length,
    failed: failures.length,
    totalBytes: results.reduce((sum, result) => sum + (result.bytes ?? 0), 0),
    results,
  };
  await writeFile(
    reportPath,
    `${JSON.stringify(report, undefined, 2)}\n`,
    "utf8",
  );
  console.log(`Download report: ${reportPath}`);
  if (failures.length > 0) {
    console.error(`${failures.length} corpus files failed to download.`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(
    `Gutenberg corpus download failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
