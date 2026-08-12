import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const ANDROID_BUILD_TOOLS_VERSION = "36.0.0";
const ANDROID_PACKAGE = "dev.chihum.persimmon";
const ANDROID_SIGNING_CERTIFICATE_SHA256 =
  "a7c15175e5f30ad9d8674ed326a64eba02715ce86c38b87c5d38b276981f88db";
const R2_BUCKET = "persimmon-downloads";
const R2_APK_KEY = "android/Persimmon-android-latest.apk";
const R2_CHECKSUM_KEY = `${R2_APK_KEY}.sha256`;
const PUBLIC_DOWNLOAD_ORIGIN = "https://downloads.persimmon.cc";
const WRANGLER_VERSION = "4.119.0";

interface Options {
  readonly apkPath: string;
  readonly dryRun: boolean;
}

interface ApkMetadata {
  readonly versionCode: string;
  readonly versionName: string;
}

function printHelp(): void {
  console.log(`Publish an existing signed Persimmon APK to Cloudflare R2.

Usage:
  pnpm publish:android:apk -- <path-to-apk>
  pnpm publish:android:apk -- --dry-run <path-to-apk>

This command never starts a build. It verifies the APK archive, package name,
target SDK, APK v2 signature, and production certificate before replacing the
public latest APK and checksum in the ${R2_BUCKET} bucket.
`);
}

function parseOptions(): Options | undefined {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return undefined;
  }

  const dryRun = args.includes("--dry-run");
  const positional = args.filter((arg) => arg !== "--" && arg !== "--dry-run");
  if (positional.length !== 1) {
    throw new Error(
      "Pass exactly one existing APK path. See `pnpm publish:android:apk -- --help`.",
    );
  }

  return {
    apkPath: path.resolve(process.cwd(), positional[0]!),
    dryRun,
  };
}

async function runAndCapture(
  command: string,
  args: readonly string[],
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: REPOSITORY_ROOT,
      env: process.env,
      stdio: ["inherit", "pipe", "inherit"],
    });
    const stdout: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`,
          ),
        );
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

async function runStreaming(
  command: string,
  args: readonly string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: REPOSITORY_ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

async function androidBuildTool(name: "aapt" | "apksigner"): Promise<string> {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Library", "Android", "sdk"),
  ].filter((root): root is string => Boolean(root));

  for (const sdkRoot of sdkRoots) {
    const candidate = path.join(
      sdkRoot,
      "build-tools",
      ANDROID_BUILD_TOOLS_VERSION,
      name,
    );
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next configured Android SDK root.
    }
  }

  throw new Error(
    `Android build-tools ${ANDROID_BUILD_TOOLS_VERSION} were not found. ` +
      `Install them with \`sdkmanager "build-tools;${ANDROID_BUILD_TOOLS_VERSION}"\`.`,
  );
}

function readApkMetadata(badging: string): ApkMetadata {
  const packageLine = badging.match(/^package: .*$/mu)?.[0];
  const versionCode = packageLine?.match(/versionCode='([^']+)'/u)?.[1];
  const versionName = packageLine?.match(/versionName='([^']+)'/u)?.[1];
  if (!versionCode || !versionName) {
    throw new Error("Could not read the APK version metadata.");
  }
  return { versionCode, versionName };
}

async function verifyAndroidApk(apkPath: string): Promise<ApkMetadata> {
  await access(apkPath);
  if (path.extname(apkPath).toLowerCase() !== ".apk") {
    throw new Error(`${apkPath} is not an APK file.`);
  }

  await runStreaming("unzip", ["-tq", apkPath]);
  const aapt = await androidBuildTool("aapt");
  const apksigner = await androidBuildTool("apksigner");
  const badging = await runAndCapture(aapt, ["dump", "badging", apkPath]);
  if (!badging.includes(`package: name='${ANDROID_PACKAGE}'`)) {
    throw new Error(`APK is not package ${ANDROID_PACKAGE}.`);
  }
  if (!badging.includes("targetSdkVersion:'36'")) {
    throw new Error("APK does not target Android SDK 36.");
  }

  const signing = await runAndCapture(apksigner, [
    "verify",
    "--verbose",
    "--print-certs",
    apkPath,
  ]);
  if (
    !signing.includes(
      "Verified using v2 scheme (APK Signature Scheme v2): true",
    )
  ) {
    throw new Error("APK is missing a valid APK v2 signature.");
  }
  if (
    !signing
      .toLowerCase()
      .includes(
        `signer #1 certificate sha-256 digest: ${ANDROID_SIGNING_CERTIFICATE_SHA256}`,
      )
  ) {
    throw new Error("APK is not signed by the production certificate.");
  }

  return readApkMetadata(badging);
}

async function sha256(filePath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.once("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}

async function uploadToR2(
  objectKey: string,
  filePath: string,
  contentType: string,
  contentDisposition?: string,
): Promise<void> {
  const args = [
    "dlx",
    `wrangler@${WRANGLER_VERSION}`,
    "r2",
    "object",
    "put",
    `${R2_BUCKET}/${objectKey}`,
    "--remote",
    "--file",
    filePath,
    "--content-type",
    contentType,
    "--cache-control",
    "no-cache, no-store, max-age=0, must-revalidate",
  ];
  if (contentDisposition) {
    args.push("--content-disposition", contentDisposition);
  }
  await runStreaming("pnpm", args);
}

async function main(): Promise<void> {
  const options = parseOptions();
  if (!options) {
    return;
  }

  console.log(`Verifying ${options.apkPath}...`);
  const metadata = await verifyAndroidApk(options.apkPath);
  const checksum = await sha256(options.apkPath);
  console.log(
    `Verified Persimmon ${metadata.versionName} (build ${metadata.versionCode}).`,
  );
  console.log(`SHA-256: ${checksum}`);

  if (options.dryRun) {
    console.log("Dry run complete; no R2 objects were changed.");
    return;
  }

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "persimmon-apk-publish-"),
  );
  const checksumPath = path.join(
    temporaryDirectory,
    "Persimmon-android-latest.apk.sha256",
  );
  try {
    await writeFile(
      checksumPath,
      `${checksum}  Persimmon-android-latest.apk\n`,
      "utf8",
    );
    await uploadToR2(
      R2_APK_KEY,
      options.apkPath,
      "application/vnd.android.package-archive",
      'attachment; filename="Persimmon-android-latest.apk"',
    );
    await uploadToR2(R2_CHECKSUM_KEY, checksumPath, "text/plain");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  console.log("\nAndroid APK published successfully.");
  console.log(`APK: ${PUBLIC_DOWNLOAD_ORIGIN}/${R2_APK_KEY}`);
  console.log(`SHA-256: ${PUBLIC_DOWNLOAD_ORIGIN}/${R2_CHECKSUM_KEY}`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
