import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { importEpub } from "@persimmon/epub-import";

interface ValidationRow {
  readonly file: string;
  readonly sections: number;
  readonly blocks: number;
  readonly resources: number;
  readonly warnings: string;
  readonly elapsedMs: number;
}

const fixtureDirectory = resolve(process.cwd(), "epubs-for-test");

async function epubFiles(): Promise<string[] | undefined> {
  try {
    const entries = await readdir(fixtureDirectory, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter(
        (entry) =>
          entry.isFile() && entry.name.toLocaleLowerCase().endsWith(".epub"),
      )
      .map((entry) => resolve(entry.parentPath, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const files = await epubFiles();
  if (!files) {
    console.log(
      "SKIP private EPUB validation: epubs-for-test/ is not present.",
    );
    return;
  }
  if (files.length === 0) {
    throw new Error("epubs-for-test/ exists but contains no .epub files");
  }

  const rows: ValidationRow[] = [];
  const failures: { file: string; error: unknown }[] = [];

  for (const file of files) {
    const startedAt = performance.now();
    try {
      const buffer = await readFile(file);
      const bytes = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
      const result = importEpub(bytes);
      const warningCounts = new Map<string, number>();
      for (const warning of result.warnings) {
        warningCounts.set(
          warning.code,
          (warningCounts.get(warning.code) ?? 0) + 1,
        );
      }
      rows.push({
        file: file.slice(fixtureDirectory.length + 1),
        sections: result.book.sections.length,
        blocks: result.book.sections.reduce(
          (total, section) => total + section.blocks.length,
          0,
        ),
        resources: Object.keys(result.resources).length,
        warnings:
          [...warningCounts]
            .map(([code, count]) => `${code}:${count}`)
            .join(", ") || "none",
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      failures.push({
        file: file.slice(fixtureDirectory.length + 1),
        error,
      });
    }
  }

  console.table(rows);
  for (const failure of failures) {
    console.error(`FAIL ${failure.file}`, failure.error);
  }
  if (failures.length > 0) {
    process.exitCode = 1;
  } else {
    console.log(`PASS private EPUB validation: ${rows.length} books.`);
  }
}

void main();
