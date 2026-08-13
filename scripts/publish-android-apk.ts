import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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
const GITHUB_RELEASE_REPOSITORY = "chihumyum/persimmon-reader";
const WRANGLER_VERSION = "4.119.0";

interface Options {
  readonly apkPath: string;
  readonly dryRun: boolean;
  readonly notesFile?: string;
  readonly prerelease: boolean;
  readonly r2Only: boolean;
}

interface ApkMetadata {
  readonly versionCode: string;
  readonly versionName: string;
}

interface GithubReleaseMetadata {
  readonly apkAssetName: string;
  readonly checksumAssetName: string;
  readonly releaseTag: string;
  readonly releaseTitle: string;
}

function printHelp(): void {
  console.log(`Publish an existing signed Persimmon APK to GitHub Releases and Cloudflare R2.

Usage:
  pnpm publish:android:apk -- <path-to-apk>
  pnpm publish:android:apk -- --dry-run <path-to-apk>
  pnpm publish:android:apk -- --notes-file <path> <path-to-apk>
  pnpm publish:android:apk -- --prerelease <path-to-apk>
  pnpm publish:android:apk -- --r2-only <path-to-apk>

This command never starts a build. It verifies the APK archive, package name,
target SDK, APK v2 signature, production certificate, and SHA-256 checksum.

By default it creates a versioned release in ${GITHUB_RELEASE_REPOSITORY},
verifies the uploaded assets, updates the stable APK and checksum in the
${R2_BUCKET} bucket, verifies both public downloads, and then publishes the
GitHub Release. --prerelease publishes only a GitHub pre-release, so the stable
R2 download is not replaced. --r2-only preserves the legacy R2-only behavior.
`);
}

function parseOptions(): Options | undefined {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return undefined;
  }

  let notesFile: string | undefined;
  const positional: string[] = [];
  let dryRun = false;
  let prerelease = process.env.PERSIMMON_RELEASE_PRERELEASE === "true";
  let r2Only = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") {
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--prerelease") {
      prerelease = true;
      continue;
    }
    if (arg === "--r2-only") {
      r2Only = true;
      continue;
    }
    if (arg === "--notes-file") {
      notesFile = args[index + 1];
      if (!notesFile) {
        throw new Error("--notes-file requires a path.");
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length !== 1) {
    throw new Error(
      "Pass exactly one existing APK path. See `pnpm publish:android:apk -- --help`.",
    );
  }
  if (prerelease && r2Only) {
    throw new Error("--prerelease and --r2-only cannot be used together.");
  }
  if (notesFile && r2Only) {
    throw new Error("--notes-file cannot be used with --r2-only.");
  }

  return {
    apkPath: path.resolve(process.cwd(), positional[0]!),
    dryRun,
    notesFile: notesFile ? path.resolve(process.cwd(), notesFile) : undefined,
    prerelease,
    r2Only,
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

interface CommandResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

async function runAndCaptureResult(
  command: string,
  args: readonly string[],
): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: REPOSITORY_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
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

function githubReleaseMetadata(metadata: ApkMetadata): GithubReleaseMetadata {
  const safeVersionName = metadata.versionName
    .trim()
    .replace(/[^0-9A-Za-z._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const safeVersionCode = metadata.versionCode
    .trim()
    .replace(/[^0-9A-Za-z._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  if (!safeVersionName || !safeVersionCode) {
    throw new Error("APK version metadata cannot form a GitHub Release name.");
  }

  const assetStem = `Persimmon-${safeVersionName}-build-${safeVersionCode}-android`;
  return {
    apkAssetName: `${assetStem}.apk`,
    checksumAssetName: `${assetStem}.apk.sha256`,
    releaseTag: `android-v${safeVersionName}-build.${safeVersionCode}`,
    releaseTitle: `Persimmon ${metadata.versionName} for Android (build ${metadata.versionCode})`,
  };
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

async function releaseNotes(
  options: Options,
  metadata: ApkMetadata,
): Promise<string> {
  const customNotes = options.notesFile
    ? await readFile(options.notesFile, "utf8")
    : (process.env.PERSIMMON_RELEASE_NOTES ?? "");
  const paragraphs = [
    `Persimmon ${metadata.versionName} for Android (build ${metadata.versionCode}).`,
  ];
  if (customNotes.trim()) {
    paragraphs.push(customNotes.trim());
  }
  paragraphs.push("Download the APK and its SHA-256 checksum below.");
  return `${paragraphs.join("\n\n")}\n`;
}

async function assertGithubAuthentication(): Promise<void> {
  const result = await runAndCaptureResult("gh", [
    "auth",
    "status",
    "--hostname",
    "github.com",
  ]);
  if (result.exitCode !== 0) {
    throw new Error(
      "GitHub authentication is unavailable. Run `gh auth login` locally, or configure GH_TOKEN in CI.",
    );
  }
}

async function createOrUpdateDraftGithubRelease(
  release: GithubReleaseMetadata,
  notesPath: string,
  apkAssetPath: string,
  checksumAssetPath: string,
): Promise<void> {
  await assertGithubAuthentication();
  const existing = await runAndCaptureResult("gh", [
    "release",
    "view",
    release.releaseTag,
    "--repo",
    GITHUB_RELEASE_REPOSITORY,
    "--json",
    "isDraft",
  ]);

  if (existing.exitCode === 0) {
    const parsed = JSON.parse(existing.stdout) as { isDraft?: boolean };
    if (parsed.isDraft !== true) {
      throw new Error(
        `GitHub Release ${release.releaseTag} is already published; refusing to replace it.`,
      );
    }
    await runStreaming("gh", [
      "release",
      "edit",
      release.releaseTag,
      "--repo",
      GITHUB_RELEASE_REPOSITORY,
      "--title",
      release.releaseTitle,
      "--notes-file",
      notesPath,
    ]);
  } else if (existing.stderr.trim() === "release not found") {
    await runStreaming("gh", [
      "release",
      "create",
      release.releaseTag,
      "--repo",
      GITHUB_RELEASE_REPOSITORY,
      "--target",
      "main",
      "--title",
      release.releaseTitle,
      "--notes-file",
      notesPath,
      "--draft",
      "--latest=false",
    ]);
  } else {
    throw new Error(
      `Could not inspect GitHub Release ${release.releaseTag}: ${existing.stderr.trim() || "unknown GitHub CLI error"}`,
    );
  }

  await runStreaming("gh", [
    "release",
    "upload",
    release.releaseTag,
    apkAssetPath,
    checksumAssetPath,
    "--repo",
    GITHUB_RELEASE_REPOSITORY,
    "--clobber",
  ]);
}

async function verifyChecksumFile(
  checksumPath: string,
  expectedChecksum: string,
): Promise<void> {
  const recordedChecksum = (await readFile(checksumPath, "utf8"))
    .trim()
    .split(/\s+/u)[0];
  if (recordedChecksum !== expectedChecksum) {
    throw new Error(`Checksum file ${checksumPath} does not match the APK.`);
  }
}

async function verifyGithubReleaseAssets(
  release: GithubReleaseMetadata,
  expectedChecksum: string,
  temporaryDirectory: string,
): Promise<void> {
  const downloadDirectory = path.join(temporaryDirectory, "github-download");
  await mkdir(downloadDirectory, { recursive: true });
  await runStreaming("gh", [
    "release",
    "download",
    release.releaseTag,
    "--repo",
    GITHUB_RELEASE_REPOSITORY,
    "--pattern",
    release.apkAssetName,
    "--pattern",
    release.checksumAssetName,
    "--dir",
    downloadDirectory,
  ]);

  const downloadedApk = path.join(downloadDirectory, release.apkAssetName);
  const downloadedChecksum = path.join(
    downloadDirectory,
    release.checksumAssetName,
  );
  if ((await sha256(downloadedApk)) !== expectedChecksum) {
    throw new Error("The GitHub Release APK checksum changed after upload.");
  }
  await verifyChecksumFile(downloadedChecksum, expectedChecksum);
}

async function publishAndVerifyR2(
  options: Options,
  metadata: ApkMetadata,
  checksum: string,
  checksumPath: string,
  temporaryDirectory: string,
): Promise<void> {
  await uploadToR2(
    R2_APK_KEY,
    options.apkPath,
    "application/vnd.android.package-archive",
    'attachment; filename="Persimmon-android-latest.apk"',
  );
  await uploadToR2(R2_CHECKSUM_KEY, checksumPath, "text/plain");

  const downloadedApk = path.join(
    temporaryDirectory,
    "Persimmon-android-latest.downloaded.apk",
  );
  const downloadedChecksum = `${downloadedApk}.sha256`;
  const versionQuery = encodeURIComponent(metadata.versionCode);
  await runStreaming("curl", [
    "--fail",
    "--location",
    "--retry",
    "3",
    "--retry-all-errors",
    "--output",
    downloadedApk,
    `${PUBLIC_DOWNLOAD_ORIGIN}/${R2_APK_KEY}?v=${versionQuery}`,
  ]);
  await runStreaming("curl", [
    "--fail",
    "--location",
    "--retry",
    "3",
    "--retry-all-errors",
    "--output",
    downloadedChecksum,
    `${PUBLIC_DOWNLOAD_ORIGIN}/${R2_CHECKSUM_KEY}?v=${versionQuery}`,
  ]);
  if ((await sha256(downloadedApk)) !== checksum) {
    throw new Error("The public R2 APK checksum changed after upload.");
  }
  await verifyChecksumFile(downloadedChecksum, checksum);
}

async function publishGithubRelease(
  release: GithubReleaseMetadata,
  prerelease: boolean,
): Promise<string> {
  const args = [
    "release",
    "edit",
    release.releaseTag,
    "--repo",
    GITHUB_RELEASE_REPOSITORY,
    "--draft=false",
  ];
  if (prerelease) {
    args.push("--prerelease", "--latest=false");
  } else {
    args.push("--prerelease=false", "--latest");
  }
  await runStreaming("gh", args);
  return (
    await runAndCapture("gh", [
      "release",
      "view",
      release.releaseTag,
      "--repo",
      GITHUB_RELEASE_REPOSITORY,
      "--json",
      "url",
      "--jq",
      ".url",
    ])
  ).trim();
}

async function main(): Promise<void> {
  const options = parseOptions();
  if (!options) {
    return;
  }

  console.log(`Verifying ${options.apkPath}...`);
  const metadata = await verifyAndroidApk(options.apkPath);
  const checksum = await sha256(options.apkPath);
  const release = githubReleaseMetadata(metadata);
  console.log(
    `Verified Persimmon ${metadata.versionName} (build ${metadata.versionCode}).`,
  );
  console.log(`SHA-256: ${checksum}`);
  console.log(
    options.r2Only
      ? `Target: Cloudflare R2 (${PUBLIC_DOWNLOAD_ORIGIN}/${R2_APK_KEY})`
      : `Targets: GitHub Release ${release.releaseTag}${options.prerelease ? " (pre-release)" : " and stable Cloudflare R2"}`,
  );

  if (options.dryRun) {
    if (options.notesFile) {
      await access(options.notesFile);
    }
    console.log(
      "Dry run complete; no GitHub Release or R2 object was changed.",
    );
    return;
  }

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "persimmon-apk-publish-"),
  );
  const r2ChecksumPath = path.join(
    temporaryDirectory,
    "Persimmon-android-latest.apk.sha256",
  );
  try {
    await writeFile(
      r2ChecksumPath,
      `${checksum}  Persimmon-android-latest.apk\n`,
      "utf8",
    );

    if (options.r2Only) {
      await publishAndVerifyR2(
        options,
        metadata,
        checksum,
        r2ChecksumPath,
        temporaryDirectory,
      );
      console.log("\nAndroid APK published to Cloudflare R2 successfully.");
      console.log(`APK: ${PUBLIC_DOWNLOAD_ORIGIN}/${R2_APK_KEY}`);
      console.log(`SHA-256: ${PUBLIC_DOWNLOAD_ORIGIN}/${R2_CHECKSUM_KEY}`);
      return;
    }

    const apkAssetPath = path.join(temporaryDirectory, release.apkAssetName);
    const checksumAssetPath = path.join(
      temporaryDirectory,
      release.checksumAssetName,
    );
    const notesPath = path.join(temporaryDirectory, "release-notes.md");
    await copyFile(options.apkPath, apkAssetPath);
    await writeFile(
      checksumAssetPath,
      `${checksum}  ${release.apkAssetName}\n`,
      "utf8",
    );
    await writeFile(notesPath, await releaseNotes(options, metadata), "utf8");

    await createOrUpdateDraftGithubRelease(
      release,
      notesPath,
      apkAssetPath,
      checksumAssetPath,
    );
    await verifyGithubReleaseAssets(release, checksum, temporaryDirectory);

    if (!options.prerelease) {
      await publishAndVerifyR2(
        options,
        metadata,
        checksum,
        r2ChecksumPath,
        temporaryDirectory,
      );
    }

    const releaseUrl = await publishGithubRelease(release, options.prerelease);
    console.log(
      `\nAndroid APK ${options.prerelease ? "pre-release" : "dual publication"} completed successfully.`,
    );
    console.log(`GitHub Release: ${releaseUrl}`);
    if (!options.prerelease) {
      console.log(`APK: ${PUBLIC_DOWNLOAD_ORIGIN}/${R2_APK_KEY}`);
      console.log(`SHA-256: ${PUBLIC_DOWNLOAD_ORIGIN}/${R2_CHECKSUM_KEY}`);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
