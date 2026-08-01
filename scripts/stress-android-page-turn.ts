import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  androidUiNodeCenter,
  findAndroidUiNode,
  parseAndroidScreenSize,
  parseAndroidUiNodes,
  type AndroidUiNode,
} from "./android-ui-hierarchy";
import { connectedAndroidDeviceSerials } from "./android-device-list";

const APP_ID = "dev.chihum.persimmon";
const REMOTE_HIERARCHY_PATH = "/sdcard/persimmon-page-turn-stress.xml";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_OUTPUT_ROOT = path.join(
  REPOSITORY_ROOT,
  ".expo",
  "page-turn-stress",
);

type ReaderLayout = "single" | "spread";
type TurnDirection = "forward" | "backward";

interface StressConfiguration {
  readonly count: number;
  readonly gapMs: number;
  readonly settleMs: number;
  readonly outputRoot: string;
}

interface StressPhaseResult {
  readonly layout: ReaderLayout;
  readonly direction: TurnDirection;
  readonly requestedInputs: number;
  readonly requestedGapMs: number;
  readonly elapsedMs: number;
  readonly measuredInputsPerSecond: number;
  readonly progressBefore: number;
  readonly progressAfter: number;
  readonly progressDelta: number;
  readonly pid: string;
}

interface StressSummary {
  device?: string;
  appId: string;
  startedAt: string;
  finishedAt?: string;
  configuration: StressConfiguration;
  initialPid?: string;
  finalPid?: string;
  phases: StressPhaseResult[];
  failure?: string;
}

function printHelp(): void {
  console.log(`Stress Persimmon page turns on one connected Android device.

Prerequisites:
  1. Install and open a development build.
  2. Open a long book in Reader, away from a completely empty publication.
  3. Keep the device unlocked and in portrait orientation.

Usage:
  pnpm stress:android:page-turn
  pnpm stress:android:page-turn -- --count 40 --gap-ms 35

Options:
  --count <n>       Inputs per direction and layout (default: 32)
  --gap-ms <n>      Delay after each injected tap (default: 45)
  --settle-ms <n>   Wait before checking each final page (default: 1800)
  --output <path>   Artifact root (default: .expo/page-turn-stress)

The script covers single/spread layouts and both forward/backward directions.
Set ANDROID_SERIAL when more than one authorized device is connected.
`);
}

function positiveInteger(value: string | undefined, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeNumber(value: string | undefined, option: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative number.`);
  }
  return parsed;
}

function parseArguments(argv: readonly string[]): StressConfiguration {
  let count = 32;
  let gapMs = 45;
  let settleMs = 1800;
  let outputRoot = DEFAULT_OUTPUT_ROOT;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--":
        break;
      case "--count":
        count = positiveInteger(argv[++index], argument);
        break;
      case "--gap-ms":
        gapMs = nonNegativeNumber(argv[++index], argument);
        break;
      case "--settle-ms":
        settleMs = nonNegativeNumber(argv[++index], argument);
        break;
      case "--output": {
        const value = argv[++index];
        if (!value) {
          throw new Error("--output requires a path.");
        }
        outputRoot = path.resolve(value);
        break;
      }
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }
  return { count, gapMs, settleMs, outputRoot };
}

function findAdb(): string {
  const candidates = [
    process.env.ANDROID_HOME
      ? path.join(process.env.ANDROID_HOME, "platform-tools", "adb")
      : undefined,
    process.env.ANDROID_SDK_ROOT
      ? path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb")
      : undefined,
    "adb",
  ].filter((candidate): candidate is string => candidate !== undefined);

  for (const candidate of candidates) {
    if (spawnSync(candidate, ["version"], { stdio: "ignore" }).status === 0) {
      return candidate;
    }
  }
  throw new Error(
    "adb was not found. Install Android platform-tools or set ANDROID_HOME.",
  );
}

function findSqlite(adb: string): string {
  const candidates = [path.join(path.dirname(adb), "sqlite3"), "sqlite3"];
  for (const candidate of candidates) {
    if (spawnSync(candidate, ["-version"], { stdio: "ignore" }).status === 0) {
      return candidate;
    }
  }
  throw new Error(
    "sqlite3 was not found. Install it or use Android platform-tools that bundle sqlite3.",
  );
}

function runAdb(
  adb: string,
  serial: string,
  args: readonly string[],
  options: { readonly binary?: boolean; readonly allowFailure?: boolean } = {},
): string | Buffer {
  const result = spawnSync(adb, ["-s", serial, ...args], {
    encoding: options.binary ? null : "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    const error = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr;
    throw new Error(
      error.trim() ||
        `adb ${args.join(" ")} exited with ${result.status ?? "unknown"}.`,
    );
  }
  return result.stdout;
}

function runAdbText(
  adb: string,
  serial: string,
  args: readonly string[],
  allowFailure = false,
): string {
  return String(runAdb(adb, serial, args, { allowFailure }));
}

function selectDevice(adb: string): string {
  const result = spawnSync(adb, ["devices", "-l"], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to query Android devices.");
  }
  const devices = connectedAndroidDeviceSerials(result.stdout);
  const requested = process.env.ANDROID_SERIAL;
  if (requested) {
    if (!devices.includes(requested)) {
      throw new Error(
        `ANDROID_SERIAL=${requested} is not a connected, authorized device.`,
      );
    }
    return requested;
  }
  if (devices.length !== 1) {
    throw new Error(
      devices.length === 0
        ? "No authorized Android device is connected."
        : `Multiple devices are connected (${devices.join(", ")}); set ANDROID_SERIAL.`,
    );
  }
  return devices[0]!;
}

function resolveLauncherActivity(adb: string, serial: string): string {
  const output = runAdbText(adb, serial, [
    "shell",
    "cmd",
    "package",
    "resolve-activity",
    "--brief",
    "-c",
    "android.intent.category.LAUNCHER",
    APP_ID,
  ]);
  const component = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${APP_ID}/`));
  if (!component) {
    throw new Error(`Unable to resolve the ${APP_ID} launcher activity.`);
  }
  return component;
}

function processId(adb: string, serial: string): string | undefined {
  const output = runAdbText(
    adb,
    serial,
    ["shell", "pidof", APP_ID],
    true,
  ).trim();
  return output.split(/\s+/).find(Boolean);
}

function assertStableProcess(
  adb: string,
  serial: string,
  initialPid: string,
): string {
  const currentPid = processId(adb, serial);
  if (!currentPid) {
    throw new Error(`${APP_ID} is no longer running.`);
  }
  if (currentPid !== initialPid) {
    throw new Error(
      `${APP_ID} restarted during stress (PID ${initialPid} -> ${currentPid}).`,
    );
  }
  return currentPid;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function dumpUiNodes(adb: string, serial: string): AndroidUiNode[] {
  runAdbText(adb, serial, [
    "shell",
    "uiautomator",
    "dump",
    REMOTE_HIERARCHY_PATH,
  ]);
  const xml = runAdbText(adb, serial, ["shell", "cat", REMOTE_HIERARCHY_PATH]);
  return parseAndroidUiNodes(xml);
}

function tapPoint(adb: string, serial: string, x: number, y: number): void {
  runAdbText(adb, serial, [
    "shell",
    "input",
    "touchscreen",
    "tap",
    String(Math.round(x)),
    String(Math.round(y)),
  ]);
}

function tapNode(adb: string, serial: string, node: AndroidUiNode): void {
  const point = androidUiNodeCenter(node);
  tapPoint(adb, serial, point.x, point.y);
}

async function waitForNode(
  adb: string,
  serial: string,
  description: string,
  attempts = 6,
): Promise<{ readonly nodes: AndroidUiNode[]; readonly node: AndroidUiNode }> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const nodes = dumpUiNodes(adb, serial);
    const node = findAndroidUiNode(nodes, description);
    if (node) {
      return { nodes, node };
    }
    await delay(300);
  }
  throw new Error(`Android UI node not found: ${description}`);
}

async function revealReaderControls(
  adb: string,
  serial: string,
  screen: { readonly width: number; readonly height: number },
): Promise<AndroidUiNode[]> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nodes = dumpUiNodes(adb, serial);
    if (findAndroidUiNode(nodes, "打开阅读布局")) {
      return nodes;
    }
    tapPoint(adb, serial, screen.width * 0.5, screen.height * 0.5);
    await delay(450);
  }
  throw new Error(
    "Reader controls did not appear. Open a book and wait for pagination before rerunning.",
  );
}

async function openLayoutPanel(
  adb: string,
  serial: string,
  screen: { readonly width: number; readonly height: number },
): Promise<AndroidUiNode[]> {
  const controls = await revealReaderControls(adb, serial, screen);
  const button = findAndroidUiNode(controls, "打开阅读布局");
  if (!button) {
    throw new Error(
      "The Reader layout button disappeared before it was tapped.",
    );
  }
  tapNode(adb, serial, button);
  await delay(350);
  return (await waitForNode(adb, serial, "单栏，每屏显示一页")).nodes;
}

async function configureLayout(
  adb: string,
  serial: string,
  screen: { readonly width: number; readonly height: number },
  layout: ReaderLayout,
): Promise<void> {
  const layoutDescription =
    layout === "single" ? "单栏，每屏显示一页" : "双栏，每屏并排显示两页";
  const naturalDescription = "自然翻页，模拟纸张卷曲与落页";
  let nodes = await openLayoutPanel(adb, serial, screen);
  let natural = findAndroidUiNode(nodes, naturalDescription);
  if (!natural) {
    throw new Error(
      "The natural page-turn option is missing from Reader settings.",
    );
  }
  if (!natural.checked) {
    tapNode(adb, serial, natural);
    await delay(350);
    nodes = dumpUiNodes(adb, serial);
    natural = findAndroidUiNode(nodes, naturalDescription);
    if (!natural?.checked) {
      throw new Error("Unable to enable the natural page-turn animation.");
    }
  }

  const option = findAndroidUiNode(nodes, layoutDescription);
  if (!option) {
    throw new Error(`The ${layout} layout option is missing.`);
  }
  if (option.checked) {
    runAdbText(adb, serial, ["shell", "input", "keyevent", "KEYCODE_BACK"]);
  } else {
    tapNode(adb, serial, option);
  }
  await delay(1800);

  const verification = await openLayoutPanel(adb, serial, screen);
  if (!findAndroidUiNode(verification, layoutDescription)?.checked) {
    throw new Error(`Reader did not switch to the ${layout} layout.`);
  }
  if (!findAndroidUiNode(verification, naturalDescription)?.checked) {
    throw new Error("Natural page-turn animation was not retained.");
  }
  runAdbText(adb, serial, ["shell", "input", "keyevent", "KEYCODE_BACK"]);
  await delay(300);

  const controls = dumpUiNodes(adb, serial);
  if (findAndroidUiNode(controls, "打开阅读布局")) {
    tapPoint(adb, serial, screen.width * 0.5, screen.height * 0.5);
    await delay(300);
  }
}

interface StoredReaderProgress {
  readonly publicationProgress?: unknown;
  readonly updatedAt?: unknown;
}

function currentReaderProgress(
  adb: string,
  serial: string,
  sqlite: string,
  snapshotPath: string,
): number {
  const database = runAdb(
    adb,
    serial,
    ["exec-out", "run-as", APP_ID, "cat", "databases/RKStorage"],
    { binary: true },
  );
  if (!Buffer.isBuffer(database) || database.length === 0) {
    throw new Error(
      "Unable to read the debug build's AsyncStorage database with run-as.",
    );
  }
  writeFileSync(snapshotPath, database);
  const query =
    "select value from catalystLocalStorage " +
    "where key like '@persimmon/library/v2/progress/%';";
  const result = spawnSync(sqlite, [snapshotPath, query], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to query Reader progress.");
  }
  const candidates = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as StoredReaderProgress];
      } catch {
        return [];
      }
    })
    .filter(
      (
        progress,
      ): progress is StoredReaderProgress & {
        readonly publicationProgress: number;
        readonly updatedAt: string;
      } =>
        typeof progress.publicationProgress === "number" &&
        Number.isFinite(progress.publicationProgress) &&
        typeof progress.updatedAt === "string",
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const current = candidates[0]?.publicationProgress;
  if (current === undefined) {
    throw new Error(
      "No persisted Reader progress was found. Open a book and wait for it to finish loading.",
    );
  }
  return current;
}

function edgePoint(
  screen: { readonly width: number; readonly height: number },
  direction: TurnDirection,
): { readonly x: number; readonly y: number } {
  return {
    x: Math.round(screen.width * (direction === "forward" ? 0.9 : 0.1)),
    y: Math.round(screen.height * 0.5),
  };
}

async function probeDirection(
  adb: string,
  serial: string,
  sqlite: string,
  snapshotPath: string,
  screen: { readonly width: number; readonly height: number },
): Promise<TurnDirection> {
  const start = currentReaderProgress(adb, serial, sqlite, snapshotPath);
  const forward = edgePoint(screen, "forward");
  tapPoint(adb, serial, forward.x, forward.y);
  await delay(1000);
  const afterForward = currentReaderProgress(adb, serial, sqlite, snapshotPath);
  if (afterForward > start) {
    const backward = edgePoint(screen, "backward");
    tapPoint(adb, serial, backward.x, backward.y);
    await delay(1000);
    return "forward";
  }

  const backward = edgePoint(screen, "backward");
  tapPoint(adb, serial, backward.x, backward.y);
  await delay(1000);
  const afterBackward = currentReaderProgress(
    adb,
    serial,
    sqlite,
    snapshotPath,
  );
  if (afterBackward < start) {
    tapPoint(adb, serial, forward.x, forward.y);
    await delay(1000);
    return "backward";
  }
  throw new Error(
    "Neither page-turn direction moved. Open a long book with natural animation enabled.",
  );
}

function runTapBurst(
  adb: string,
  serial: string,
  point: { readonly x: number; readonly y: number },
  count: number,
  gapMs: number,
): number {
  const sleep = gapMs > 0 ? `sleep ${(gapMs / 1000).toFixed(3)}; ` : "";
  const command =
    `i=0; while [ "$i" -lt ${count} ]; do ` +
    `input touchscreen tap ${point.x} ${point.y}; ` +
    `i=$((i+1)); ${sleep}done`;
  const startedAt = performance.now();
  runAdbText(adb, serial, ["shell", command]);
  return performance.now() - startedAt;
}

function screenshot(adb: string, serial: string, destination: string): void {
  const output = runAdb(adb, serial, ["exec-out", "screencap", "-p"], {
    binary: true,
  });
  if (!Buffer.isBuffer(output)) {
    throw new Error("Android screenshot did not return binary data.");
  }
  writeFileSync(destination, output);
}

function oppositeDirection(direction: TurnDirection): TurnDirection {
  return direction === "forward" ? "backward" : "forward";
}

function assertDirectionMoved(
  direction: TurnDirection,
  before: number,
  after: number,
): void {
  if (direction === "forward" ? after <= before : after >= before) {
    throw new Error(
      `${direction} burst did not move in the expected direction (${(before * 100).toFixed(4)}% -> ${(after * 100).toFixed(4)}%).`,
    );
  }
}

function fatalLogEvidence(logcat: string, crashBuffer: string): string[] {
  const patterns = [
    new RegExp(`ANR in ${APP_ID.replaceAll(".", "\\.")}`),
    new RegExp(`Process: ${APP_ID.replaceAll(".", "\\.")}, PID:`),
    /ReactNativeJS.*(?:TypeError|ReferenceError|Uncaught Error)/,
    /OutOfMemoryError/,
  ];
  return [...logcat.split(/\r?\n/), ...crashBuffer.split(/\r?\n/)].filter(
    (line) => patterns.some((pattern) => pattern.test(line)),
  );
}

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function runLayoutStress(
  adb: string,
  serial: string,
  sqlite: string,
  snapshotPath: string,
  initialPid: string,
  screen: { readonly width: number; readonly height: number },
  layout: ReaderLayout,
  configuration: StressConfiguration,
  outputDirectory: string,
): Promise<StressPhaseResult[]> {
  console.log(`\nConfiguring ${layout} layout...`);
  await configureLayout(adb, serial, screen, layout);
  assertStableProcess(adb, serial, initialPid);
  const primary = await probeDirection(
    adb,
    serial,
    sqlite,
    snapshotPath,
    screen,
  );
  const directions = [primary, oppositeDirection(primary)] as const;
  const results: StressPhaseResult[] = [];

  for (const direction of directions) {
    const progressBefore = currentReaderProgress(
      adb,
      serial,
      sqlite,
      snapshotPath,
    );
    screenshot(
      adb,
      serial,
      path.join(outputDirectory, `${layout}-${direction}-before.png`),
    );
    const point = edgePoint(screen, direction);
    console.log(
      `  ${direction}: ${configuration.count} taps, ${configuration.gapMs}ms gap...`,
    );
    const elapsedMs = runTapBurst(
      adb,
      serial,
      point,
      configuration.count,
      configuration.gapMs,
    );
    await delay(configuration.settleMs);
    const progressAfter = currentReaderProgress(
      adb,
      serial,
      sqlite,
      snapshotPath,
    );
    assertDirectionMoved(direction, progressBefore, progressAfter);
    const pid = assertStableProcess(adb, serial, initialPid);
    screenshot(
      adb,
      serial,
      path.join(outputDirectory, `${layout}-${direction}-after.png`),
    );
    const measuredInputsPerSecond =
      configuration.count / Math.max(0.001, elapsedMs / 1000);
    const result = {
      layout,
      direction,
      requestedInputs: configuration.count,
      requestedGapMs: configuration.gapMs,
      elapsedMs: Math.round(elapsedMs),
      measuredInputsPerSecond: Number(measuredInputsPerSecond.toFixed(2)),
      progressBefore,
      progressAfter,
      progressDelta: progressAfter - progressBefore,
      pid,
    } satisfies StressPhaseResult;
    results.push(result);
    console.log(
      `    progress ${(progressBefore * 100).toFixed(3)}% -> ${(progressAfter * 100).toFixed(3)}%; ${result.measuredInputsPerSecond} inputs/s; PID ${pid}`,
    );
  }
  return results;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const configuration = parseArguments(process.argv.slice(2));
  const adb = findAdb();
  const sqlite = findSqlite(adb);
  const serial = selectDevice(adb);
  const packagePath = runAdbText(
    adb,
    serial,
    ["shell", "pm", "path", APP_ID],
    true,
  );
  if (!packagePath.includes("package:")) {
    throw new Error(
      `${APP_ID} is not installed. Install the Android development build first.`,
    );
  }

  const outputDirectory = path.join(configuration.outputRoot, timestamp());
  mkdirSync(outputDirectory, { recursive: true });
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), "persimmon-page-turn-stress-"),
  );
  const snapshotPath = path.join(temporaryDirectory, "RKStorage.sqlite");
  console.log(`Artifacts: ${outputDirectory}`);

  const summary: StressSummary = {
    device: serial,
    appId: APP_ID,
    startedAt: new Date().toISOString(),
    configuration,
    phases: [],
  };
  let failure: unknown;

  try {
    const launcher = resolveLauncherActivity(adb, serial);
    runAdbText(adb, serial, ["shell", "am", "start", "-W", "-n", launcher]);
    await delay(1200);
    const initialPid = processId(adb, serial);
    if (!initialPid) {
      throw new Error(`${APP_ID} did not start.`);
    }
    summary.initialPid = initialPid;
    const screen = parseAndroidScreenSize(
      runAdbText(adb, serial, ["shell", "wm", "size"]),
    );
    const readerNodes = dumpUiNodes(adb, serial);
    if (
      !findAndroidUiNode(readerNodes, "上一页") ||
      !findAndroidUiNode(readerNodes, "下一页")
    ) {
      throw new Error(
        "Reader page-turn regions are unavailable. Open a book before rerunning.",
      );
    }
    currentReaderProgress(adb, serial, sqlite, snapshotPath);

    runAdbText(adb, serial, ["logcat", "-b", "all", "-c"]);
    runAdbText(
      adb,
      serial,
      ["shell", "dumpsys", "gfxinfo", APP_ID, "reset"],
      true,
    );
    writeFileSync(
      path.join(outputDirectory, "meminfo-before.txt"),
      runAdbText(adb, serial, ["shell", "dumpsys", "meminfo", APP_ID], true),
    );

    summary.phases.push(
      ...(await runLayoutStress(
        adb,
        serial,
        sqlite,
        snapshotPath,
        initialPid,
        screen,
        "single",
        configuration,
        outputDirectory,
      )),
    );
    summary.phases.push(
      ...(await runLayoutStress(
        adb,
        serial,
        sqlite,
        snapshotPath,
        initialPid,
        screen,
        "spread",
        configuration,
        outputDirectory,
      )),
    );
    summary.finalPid = assertStableProcess(adb, serial, initialPid);
  } catch (error) {
    failure = error;
    summary.failure = error instanceof Error ? error.message : String(error);
  } finally {
    summary.finishedAt = new Date().toISOString();
    const logcat = runAdbText(
      adb,
      serial,
      ["logcat", "-b", "main", "-b", "system", "-d", "-v", "threadtime"],
      true,
    );
    const crashBuffer = runAdbText(
      adb,
      serial,
      ["logcat", "-b", "crash", "-d", "-v", "threadtime"],
      true,
    );
    writeFileSync(path.join(outputDirectory, "logcat.txt"), logcat);
    writeFileSync(path.join(outputDirectory, "crash-buffer.txt"), crashBuffer);
    writeFileSync(
      path.join(outputDirectory, "gfxinfo.txt"),
      runAdbText(adb, serial, ["shell", "dumpsys", "gfxinfo", APP_ID], true),
    );
    writeFileSync(
      path.join(outputDirectory, "meminfo-after.txt"),
      runAdbText(adb, serial, ["shell", "dumpsys", "meminfo", APP_ID], true),
    );
    writeFileSync(
      path.join(outputDirectory, "exit-info.txt"),
      runAdbText(
        adb,
        serial,
        ["shell", "dumpsys", "activity", "exit-info", APP_ID],
        true,
      ),
    );
    const fatalEvidence = fatalLogEvidence(logcat, crashBuffer);
    if (!failure && fatalEvidence.length > 0) {
      summary.failure = `Fatal Android evidence:\n${fatalEvidence.join("\n")}`;
      failure = new Error(summary.failure);
    }
    writeFileSync(
      path.join(outputDirectory, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }

  if (failure) {
    throw failure;
  }
  console.log(
    `\nPASS: ${summary.phases.length} page-turn stress phases completed.`,
  );
  console.log(`Summary: ${path.join(outputDirectory, "summary.json")}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nAndroid page-turn stress failed: ${message}`);
  process.exitCode = 1;
});
