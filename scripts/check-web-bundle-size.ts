import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIST_DIRECTORY = path.resolve("apps/persimmon/dist");
// Raw export accounting includes both complete offline Simplified Chinese
// reading typefaces.
const MAXIMUM_RAW_MIB = 42;
const MAXIMUM_RAW_BYTES = MAXIMUM_RAW_MIB * 1024 * 1024;

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  for (const name of await readdir(directory)) {
    const target = path.join(directory, name);
    const metadata = await stat(target);
    total += metadata.isDirectory()
      ? await directoryBytes(target)
      : metadata.size;
  }
  return total;
}

async function main(): Promise<void> {
  const rawBytes = await directoryBytes(DIST_DIRECTORY);
  const rawMiB = rawBytes / 1024 / 1024;
  if (rawBytes > MAXIMUM_RAW_BYTES) {
    throw new Error(
      `Web export is ${rawMiB.toFixed(2)} MiB, above the ${MAXIMUM_RAW_MIB} MiB budget.`,
    );
  }

  console.log(
    `PASS web export budget: ${rawMiB.toFixed(2)} MiB / ${MAXIMUM_RAW_MIB.toFixed(2)} MiB raw.`,
  );
}

void main();
