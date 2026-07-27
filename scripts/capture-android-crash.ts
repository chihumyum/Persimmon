import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { connectedAndroidDeviceSerials } from "./android-device-list";

const APP_ID = "dev.chihum.persimmon";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, ".expo", "crash-logs");

function printHelp(): void {
  console.log(`Capture Persimmon Android native crash logs.

Usage:
  pnpm crash:android
  pnpm crash:android:bugreport

The app must already be installed on one connected Android device. The script
clears old Logcat entries, launches ${APP_ID}, and records the complete native
log until Ctrl+C. Set ANDROID_SERIAL when multiple devices are connected.

Output:
  ${path.relative(REPOSITORY_ROOT, OUTPUT_DIRECTORY)}/
`);
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
    const probe = spawnSync(candidate, ["version"], { stdio: "ignore" });
    if (probe.status === 0) {
      return candidate;
    }
  }
  throw new Error(
    "adb was not found. Install Android platform-tools or set ANDROID_HOME.",
  );
}

function runAdb(adb: string, args: readonly string[]) {
  return spawnSync(adb, args, {
    encoding: "utf8",
    env: process.env,
  });
}

function assertSingleConnectedDevice(adb: string): string {
  const result = runAdb(adb, ["devices", "-l"]);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to query Android devices.");
  }
  const devices = connectedAndroidDeviceSerials(result.stdout);
  const requestedSerial = process.env.ANDROID_SERIAL;
  if (requestedSerial) {
    if (!devices.includes(requestedSerial)) {
      throw new Error(
        `ANDROID_SERIAL=${requestedSerial} is not a connected, authorized device.`,
      );
    }
    return requestedSerial;
  }
  if (devices.length === 0) {
    throw new Error(
      "No authorized Android device is connected. Check `adb devices -l`.",
    );
  }
  if (devices.length > 1) {
    throw new Error(
      `Multiple Android devices are connected (${devices.join(", ")}). ` +
        "Set ANDROID_SERIAL before running the command.",
    );
  }
  return devices[0]!;
}

function assertAppInstalled(adb: string): void {
  const result = runAdb(adb, ["shell", "pm", "path", APP_ID]);
  if (result.status !== 0 || !result.stdout.includes("package:")) {
    throw new Error(
      `${APP_ID} is not installed. Run \`pnpm native:android:device\` once first.`,
    );
  }
}

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function captureLogcat(
  adb: string,
  serial: string,
  logPath: string,
): Promise<void> {
  const clearResult = runAdb(adb, ["logcat", "-c"]);
  if (clearResult.status !== 0) {
    throw new Error(clearResult.stderr.trim() || "Unable to clear Logcat.");
  }
  runAdb(adb, ["shell", "am", "force-stop", APP_ID]);

  const output = createWriteStream(logPath, { encoding: "utf8" });
  output.write(`# Persimmon Android crash capture\n`);
  output.write(`# Device: ${serial}\n`);
  output.write(`# App: ${APP_ID}\n`);
  output.write(`# Started: ${new Date().toISOString()}\n`);

  const logcat = spawn(adb, ["logcat", "-v", "threadtime"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  logcat.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    output.write(chunk);
  });
  logcat.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
    output.write(chunk);
  });

  const launchResult = runAdb(adb, [
    "shell",
    "monkey",
    "-p",
    APP_ID,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);
  if (launchResult.status !== 0) {
    logcat.kill();
    output.end();
    throw new Error(
      launchResult.stderr.trim() || `Unable to launch ${APP_ID}.`,
    );
  }

  console.log(`\nCapturing ${APP_ID} on ${serial}.`);
  console.log("Reproduce the crash, then press Ctrl+C.\n");

  await new Promise<void>((resolve, reject) => {
    let stopping = false;
    const stop = () => {
      if (stopping) {
        return;
      }
      stopping = true;
      logcat.kill("SIGTERM");
    };
    const handleSignal = () => stop();
    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);
    logcat.once("error", reject);
    logcat.once("close", (code) => {
      process.removeListener("SIGINT", handleSignal);
      process.removeListener("SIGTERM", handleSignal);
      output.end(() => {
        if (!stopping && code !== 0) {
          reject(
            new Error(`adb logcat exited with code ${code ?? "unknown"}.`),
          );
          return;
        }
        resolve();
      });
    });
  });
}

async function createBugreport(
  adb: string,
  destination: string,
): Promise<void> {
  console.log(
    "\nGenerating an Android bugreport. This can take several minutes and may " +
      "contain device-sensitive information.",
  );
  const result = spawnSync(adb, ["bugreport", destination], {
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`adb bugreport exited with code ${result.status}.`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  const includeBugreport = process.argv.includes("--bugreport");
  const adb = findAdb();
  const serial = assertSingleConnectedDevice(adb);
  assertAppInstalled(adb);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const captureTimestamp = timestamp();
  const logPath = path.join(
    OUTPUT_DIRECTORY,
    `android-${captureTimestamp}.log`,
  );
  await captureLogcat(adb, serial, logPath);

  console.log(`\nCrash log saved to:\n${logPath}`);
  if (includeBugreport) {
    const bugreportPath = path.join(
      OUTPUT_DIRECTORY,
      `android-${captureTimestamp}-bugreport.zip`,
    );
    await createBugreport(adb, bugreportPath);
    console.log(`\nBugreport saved to:\n${bugreportPath}`);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nCrash capture failed: ${message}`);
  process.exitCode = 1;
});
