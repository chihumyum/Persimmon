import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import {
  EPUB_COMPILER_VERSION,
  EpubImportError,
  importEpub,
} from "@persimmon/epub-import";

type EpubVariant = "epub2-images" | "epub3-images";

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
  readonly mirrorBase: string;
  readonly selection: {
    readonly selectedTitles: number;
    readonly files: number;
  };
  readonly items: readonly CorpusItem[];
}

interface SuccessRow {
  readonly status: "passed";
  readonly id: number;
  readonly title: string;
  readonly language: string;
  readonly variant: EpubVariant;
  readonly relativePath: string;
  readonly bytes: number;
  readonly sections: number;
  readonly blocks: number;
  readonly resources: number;
  readonly warnings: Readonly<Record<string, number>>;
  readonly warningTotal: number;
  readonly elapsedMs: number;
}

interface FailureRow {
  readonly status: "failed";
  readonly id: number;
  readonly title: string;
  readonly language: string;
  readonly variant: EpubVariant;
  readonly relativePath: string;
  readonly bytes?: number;
  readonly errorCode: string;
  readonly error: string;
  readonly context?: string;
  readonly elapsedMs: number;
}

type ValidationRow = SuccessRow | FailureRow;

interface GroupSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function corpusRoot(): string {
  const root =
    argumentValue("--root") ?? process.env.PERSIMMON_EPUB_CORPUS_ROOT;
  if (!root) {
    throw new Error(
      "Missing corpus root. Pass --root <directory> or set PERSIMMON_EPUB_CORPUS_ROOT.",
    );
  }
  return root;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index] as number;
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarizeRows(rows: readonly ValidationRow[]): GroupSummary {
  const passed = rows.filter((row) => row.status === "passed").length;
  return {
    total: rows.length,
    passed,
    failed: rows.length - passed,
    passRate: rows.length === 0 ? 0 : round((passed / rows.length) * 100),
  };
}

function groupRows(
  rows: readonly ValidationRow[],
  key: (row: ValidationRow) => string,
): Readonly<Record<string, GroupSummary>> {
  const groups = new Map<string, ValidationRow[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }
  return Object.fromEntries(
    [...groups]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupKey, group]) => [groupKey, summarizeRows(group)]),
  );
}

function aggregateCounts(
  entries: Iterable<readonly [string, number]>,
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const [key, count] of entries) {
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function gitCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

async function validateItem(
  root: string,
  item: CorpusItem,
): Promise<ValidationRow> {
  const path = join(root, item.relativePath);
  const startedAt = performance.now();
  let bytes: Uint8Array;
  try {
    const buffer = await readFile(path);
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch (error) {
    return {
      status: "failed",
      id: item.id,
      title: item.title,
      language: item.language,
      variant: item.variant,
      relativePath: item.relativePath,
      errorCode: "file-read-failed",
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }

  try {
    const result = importEpub(bytes);
    const warnings = aggregateCounts(
      result.warnings.map((warning) => [warning.code, 1] as const),
    );
    const sections = result.book.sections.length;
    const blocks = result.book.sections.reduce(
      (total, section) => total + section.blocks.length,
      0,
    );
    if (sections === 0 || blocks === 0) {
      throw new Error(
        `Importer returned an empty publication (${sections} sections, ${blocks} blocks)`,
      );
    }
    return {
      status: "passed",
      id: item.id,
      title: item.title,
      language: item.language,
      variant: item.variant,
      relativePath: item.relativePath,
      bytes: bytes.byteLength,
      sections,
      blocks,
      resources: Object.keys(result.resources).length,
      warnings,
      warningTotal: Object.values(warnings).reduce(
        (sum, count) => sum + count,
        0,
      ),
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      status: "failed",
      id: item.id,
      title: item.title,
      language: item.language,
      variant: item.variant,
      relativePath: item.relativePath,
      bytes: bytes.byteLength,
      errorCode:
        error instanceof EpubImportError
          ? error.code
          : "unexpected-import-error",
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof EpubImportError && error.context
        ? { context: error.context }
        : {}),
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }
}

function pairedComparisons(rows: readonly ValidationRow[]) {
  const pairs = new Map<number, ValidationRow[]>();
  for (const row of rows) {
    const group = pairs.get(row.id) ?? [];
    group.push(row);
    pairs.set(row.id, group);
  }
  const paired = [...pairs.values()].filter((group) => group.length === 2);
  const bothPassed = paired.filter((group) =>
    group.every((row) => row.status === "passed"),
  );
  const outcomeMismatches = paired
    .filter(
      (group) => group.filter((row) => row.status === "passed").length === 1,
    )
    .map((group) => group[0]?.id);
  const structureMismatches = bothPassed.flatMap((group) => {
    const [left, right] = group as [SuccessRow, SuccessRow];
    return left.sections === right.sections &&
      left.blocks === right.blocks &&
      left.resources === right.resources
      ? []
      : [
          {
            id: left.id,
            epub2:
              left.variant === "epub2-images"
                ? {
                    sections: left.sections,
                    blocks: left.blocks,
                    resources: left.resources,
                  }
                : {
                    sections: right.sections,
                    blocks: right.blocks,
                    resources: right.resources,
                  },
            epub3:
              left.variant === "epub3-images"
                ? {
                    sections: left.sections,
                    blocks: left.blocks,
                    resources: left.resources,
                  }
                : {
                    sections: right.sections,
                    blocks: right.blocks,
                    resources: right.resources,
                  },
          },
        ];
  });
  return {
    total: paired.length,
    bothPassed: bothPassed.length,
    outcomeMismatches,
    structureMismatchCount: structureMismatches.length,
    structureMismatches,
  };
}

function markdownTable(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const sanitized = rows.map((row) =>
    row.map((cell) => String(cell).replaceAll("|", "\\|").replace(/\s+/g, " ")),
  );
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...sanitized.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function summaryMarkdown(report: {
  readonly completedAt: string;
  readonly runtime: {
    readonly gitCommit: string;
    readonly node: string;
    readonly epubCompilerVersion: number;
  };
  readonly summary: GroupSummary & {
    readonly elapsedMs: number;
    readonly totalBytes: number;
    readonly warningTotal: number;
  };
  readonly performance: {
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly p99Ms: number;
    readonly maxMs: number;
  };
  readonly byVariant: Readonly<Record<string, GroupSummary>>;
  readonly byLanguage: Readonly<Record<string, GroupSummary>>;
  readonly warningCounts: Readonly<Record<string, number>>;
  readonly failureCounts: Readonly<Record<string, number>>;
  readonly paired: ReturnType<typeof pairedComparisons>;
  readonly slowest: readonly ValidationRow[];
  readonly failures: readonly FailureRow[];
}): string {
  const lines = [
    "# Persimmon Project Gutenberg EPUB compatibility report",
    "",
    `Generated: ${report.completedAt}`,
    `Git commit: \`${report.runtime.gitCommit}\``,
    `Node: \`${report.runtime.node}\``,
    `EPUB compiler version: \`${report.runtime.epubCompilerVersion}\``,
    "",
    "## Result",
    "",
    `- Passed: ${report.summary.passed}/${report.summary.total} (${report.summary.passRate}%)`,
    `- Failed: ${report.summary.failed}`,
    `- Corpus size: ${(report.summary.totalBytes / 1024 / 1024).toFixed(1)} MiB`,
    `- Total validation time: ${(report.summary.elapsedMs / 1000).toFixed(1)} s`,
    `- Import latency: p50 ${report.performance.p50Ms} ms, p95 ${report.performance.p95Ms} ms, p99 ${report.performance.p99Ms} ms, max ${report.performance.maxMs} ms`,
    `- Warnings: ${report.summary.warningTotal}`,
    "",
    "## EPUB version",
    "",
    markdownTable(
      ["Variant", "Total", "Passed", "Failed", "Pass rate"],
      Object.entries(report.byVariant).map(([variant, group]) => [
        variant,
        group.total,
        group.passed,
        group.failed,
        `${group.passRate}%`,
      ]),
    ),
    "",
    "## Language",
    "",
    markdownTable(
      ["Language", "Total", "Passed", "Failed", "Pass rate"],
      Object.entries(report.byLanguage).map(([language, group]) => [
        language,
        group.total,
        group.passed,
        group.failed,
        `${group.passRate}%`,
      ]),
    ),
    "",
    "## Paired EPUB 2 / EPUB 3 titles",
    "",
    `- Pairs: ${report.paired.total}`,
    `- Both passed: ${report.paired.bothPassed}`,
    `- Outcome mismatches: ${report.paired.outcomeMismatches.length}`,
    `- Structure mismatches: ${report.paired.structureMismatchCount}`,
    "",
    "## Warning counts",
    "",
    Object.keys(report.warningCounts).length === 0
      ? "None."
      : markdownTable(
          ["Warning", "Count"],
          Object.entries(report.warningCounts),
        ),
    "",
    "## Failure counts",
    "",
    Object.keys(report.failureCounts).length === 0
      ? "None."
      : markdownTable(["Error", "Count"], Object.entries(report.failureCounts)),
    "",
    "## Slowest imports",
    "",
    markdownTable(
      ["ID", "Language", "Variant", "Time", "Size", "Title"],
      report.slowest.map((row) => [
        row.id,
        row.language,
        row.variant,
        `${row.elapsedMs} ms`,
        `${(((row.bytes ?? 0) as number) / 1024 / 1024).toFixed(1)} MiB`,
        row.title,
      ]),
    ),
  ];

  if (report.failures.length > 0) {
    lines.push(
      "",
      "## Failures",
      "",
      markdownTable(
        ["ID", "Language", "Variant", "Error", "Title"],
        report.failures.map((row) => [
          row.id,
          row.language,
          row.variant,
          `${row.errorCode}: ${row.error}`,
          row.title,
        ]),
      ),
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const root = corpusRoot();
  const manifestPath = join(root, "manifest.json");
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as CorpusManifest;
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported manifest schema ${manifest.schemaVersion}`);
  }
  if (manifest.items.length === 0) {
    throw new Error("Corpus manifest has no EPUB files");
  }

  console.log(
    `Validating ${manifest.items.length} EPUB files from ${root} sequentially.`,
  );
  const startedAt = Date.now();
  const rows: ValidationRow[] = [];
  for (const [index, item] of manifest.items.entries()) {
    rows.push(await validateItem(root, item));
    const completed = index + 1;
    if (
      completed === 1 ||
      completed % 10 === 0 ||
      completed === manifest.items.length
    ) {
      const summary = summarizeRows(rows);
      console.log(
        `Validated ${completed}/${manifest.items.length}; passed: ${summary.passed}, failed: ${summary.failed}`,
      );
    }
  }

  const completedAt = new Date().toISOString();
  const successful = rows.filter(
    (row): row is SuccessRow => row.status === "passed",
  );
  const failures = rows.filter(
    (row): row is FailureRow => row.status === "failed",
  );
  const elapsedValues = rows.map((row) => row.elapsedMs);
  const baseSummary = summarizeRows(rows);
  const report = {
    schemaVersion: 1,
    corpusManifest: manifestPath,
    corpusGeneratedAt: manifest.generatedAt,
    startedAt: new Date(startedAt).toISOString(),
    completedAt,
    runtime: {
      gitCommit: gitCommit(),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      epubCompilerVersion: EPUB_COMPILER_VERSION,
    },
    summary: {
      ...baseSummary,
      elapsedMs: Date.now() - startedAt,
      totalBytes: rows.reduce((sum, row) => sum + (row.bytes ?? 0), 0),
      sections: successful.reduce((sum, row) => sum + row.sections, 0),
      blocks: successful.reduce((sum, row) => sum + row.blocks, 0),
      resources: successful.reduce((sum, row) => sum + row.resources, 0),
      warningTotal: successful.reduce((sum, row) => sum + row.warningTotal, 0),
    },
    performance: {
      p50Ms: percentile(elapsedValues, 0.5),
      p95Ms: percentile(elapsedValues, 0.95),
      p99Ms: percentile(elapsedValues, 0.99),
      maxMs: Math.max(...elapsedValues),
    },
    byVariant: groupRows(rows, (row) => row.variant),
    byLanguage: groupRows(rows, (row) => row.language),
    warningCounts: aggregateCounts(
      successful.flatMap((row) => Object.entries(row.warnings)),
    ),
    warningBookCounts: aggregateCounts(
      successful.flatMap((row) =>
        Object.keys(row.warnings).map((warning) => [warning, 1] as const),
      ),
    ),
    failureCounts: aggregateCounts(
      failures.map((row) => [row.errorCode, 1] as const),
    ),
    paired: pairedComparisons(rows),
    slowest: [...rows]
      .sort((left, right) => right.elapsedMs - left.elapsedMs)
      .slice(0, 20),
    failures,
    rows,
  };

  const reportDirectory = join(root, "reports");
  await mkdir(reportDirectory, { recursive: true });
  const timestamp = completedAt.replaceAll(":", "-");
  const jsonPath = join(reportDirectory, `validation-${timestamp}.json`);
  const markdownPath = join(reportDirectory, `validation-${timestamp}.md`);
  const markdown = summaryMarkdown(report);
  await writeFile(
    jsonPath,
    `${JSON.stringify(report, undefined, 2)}\n`,
    "utf8",
  );
  await writeFile(markdownPath, markdown, "utf8");
  await writeFile(
    join(reportDirectory, "latest.json"),
    `${JSON.stringify(report, undefined, 2)}\n`,
    "utf8",
  );
  await writeFile(join(reportDirectory, "latest.md"), markdown, "utf8");

  console.log(
    `Validation complete: ${report.summary.passed}/${report.summary.total} passed (${report.summary.passRate}%).`,
  );
  console.log(`Report: ${markdownPath}`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(
    `EPUB corpus validation failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
