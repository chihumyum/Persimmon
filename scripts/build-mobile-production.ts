import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const APP_DIRECTORY = path.join(REPOSITORY_ROOT, "apps", "persimmon");
const ANDROID_BUILD_TOOLS_VERSION = "36.0.0";
const ANDROID_PACKAGE = "dev.chihum.persimmon";
const ANDROID_SIGNING_CERTIFICATE_SHA256 =
  "a7c15175e5f30ad9d8674ed326a64eba02715ce86c38b87c5d38b276981f88db";

type Platform = "android" | "ios";

interface PlatformConfig {
  readonly artifactLabel: "APK" | "IPA";
  readonly extension: "apk" | "ipa";
  readonly platform: Platform;
  readonly profile: "production" | "production-apk";
}

const PLATFORM_CONFIGS: Readonly<Record<Platform, PlatformConfig>> = {
  android: {
    artifactLabel: "APK",
    extension: "apk",
    platform: "android",
    profile: "production-apk",
  },
  ios: {
    artifactLabel: "IPA",
    extension: "ipa",
    platform: "ios",
    profile: "production",
  },
};

interface EasBuildResult {
  readonly id?: string;
  readonly status?: string;
  readonly appVersion?: string;
  readonly appBuildVersion?: string;
  readonly artifacts?: {
    readonly applicationArchiveUrl?: string;
    readonly buildUrl?: string;
  };
  readonly project?: {
    readonly slug?: string;
    readonly ownerAccount?: {
      readonly name?: string;
    };
  };
}

function printHelp(): void {
  console.log(`Build and download a signed Persimmon production artifact.

Usage:
  pnpm release:ios
  pnpm release:android

Before starting, the script verifies that the Git worktree is clean and that
HEAD matches its fetched upstream branch. EAS then builds the production
profile, waits for completion, and downloads the artifact to:

  dist/ios/
  dist/android/
`);
}

function selectedPlatform(): PlatformConfig {
  const platform = process.argv[2];
  if (platform === "android" || platform === "ios") {
    return PLATFORM_CONFIGS[platform];
  }
  throw new Error(
    "Missing platform. Run `pnpm release:ios` or `pnpm release:android`.",
  );
}

function runGit(args: readonly string[]): string {
  const result = spawnSync("git", [...args], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        `git ${args.join(" ")} exited with code ${result.status ?? "unknown"}.`,
    );
  }
  return result.stdout.trim();
}

function assertCleanPushedCommit(artifactLabel: string): void {
  const changes = runGit(["status", "--porcelain", "--untracked-files=normal"]);
  if (changes.length > 0) {
    throw new Error(
      "The Git worktree is not clean. Commit or stash every change before " +
        `building the ${artifactLabel}:\n${changes}`,
    );
  }

  const branch = runGit(["branch", "--show-current"]);
  if (branch.length === 0) {
    throw new Error("The repository is in detached HEAD state.");
  }

  let upstream: string;
  try {
    upstream = runGit([
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);
  } catch {
    throw new Error(
      `Branch ${branch} has no upstream. Push it before building the ${artifactLabel}.`,
    );
  }

  console.log(`Fetching ${upstream}...`);
  runGit(["fetch", "--quiet"]);

  const [behindText, aheadText] = runGit([
    "rev-list",
    "--left-right",
    "--count",
    `${upstream}...HEAD`,
  ]).split(/\s+/u);
  const behind = Number.parseInt(behindText ?? "", 10);
  const ahead = Number.parseInt(aheadText ?? "", 10);
  if (behind !== 0 || ahead !== 0) {
    throw new Error(
      `HEAD does not match ${upstream} (behind ${behind}, ahead ${ahead}). ` +
        "Pull or push the branch before building.",
    );
  }

  console.log(
    `Building clean commit ${runGit(["rev-parse", "--short", "HEAD"])}.`,
  );
}

async function runAndCapture(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
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

async function verifyAndroidApk(apkPath: string): Promise<void> {
  const aapt = await androidBuildTool("aapt");
  const apksigner = await androidBuildTool("apksigner");
  const badging = await runAndCapture(
    aapt,
    ["dump", "badging", apkPath],
    REPOSITORY_ROOT,
  );
  if (!badging.includes(`package: name='${ANDROID_PACKAGE}'`)) {
    throw new Error(`Downloaded APK is not package ${ANDROID_PACKAGE}.`);
  }
  if (!badging.includes("targetSdkVersion:'36'")) {
    throw new Error("Downloaded APK does not target Android SDK 36.");
  }

  const signing = await runAndCapture(
    apksigner,
    ["verify", "--verbose", "--print-certs", apkPath],
    REPOSITORY_ROOT,
  );
  if (
    !signing.includes(
      "Verified using v2 scheme (APK Signature Scheme v2): true",
    )
  ) {
    throw new Error("Downloaded APK is missing a valid APK v2 signature.");
  }
  if (
    !signing
      .toLowerCase()
      .includes(
        `signer #1 certificate sha-256 digest: ${ANDROID_SIGNING_CERTIFICATE_SHA256}`,
      )
  ) {
    throw new Error(
      "Downloaded APK is not signed by the production certificate.",
    );
  }
}

function parseBuildResult(stdout: string): EasBuildResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(
      `EAS returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error("EAS did not return exactly one build result.");
  }
  return parsed[0] as EasBuildResult;
}

function safeFilePart(value: string | undefined, fallback: string): string {
  const normalized = value?.replaceAll(/[^0-9A-Za-z._-]/gu, "-");
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildPageUrl(build: EasBuildResult): string | undefined {
  const owner = build.project?.ownerAccount?.name;
  const slug = build.project?.slug;
  if (!owner || !slug || !build.id) {
    return undefined;
  }
  return `https://expo.dev/accounts/${owner}/projects/${slug}/builds/${build.id}`;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const config = selectedPlatform();
  const outputDirectory = path.join(REPOSITORY_ROOT, "dist", config.platform);
  assertCleanPushedCommit(config.artifactLabel);

  console.log(`Starting the EAS ${config.platform} ${config.profile} build...`);
  const buildOutput = await runAndCapture(
    "pnpm",
    [
      "dlx",
      "eas-cli@latest",
      "build",
      "--platform",
      config.platform,
      "--profile",
      config.profile,
      "--non-interactive",
      "--wait",
      "--json",
    ],
    APP_DIRECTORY,
  );
  const build = parseBuildResult(buildOutput);
  const artifactUrl =
    build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;
  if (build.status !== "FINISHED" || !artifactUrl) {
    throw new Error(
      `EAS build ${build.id ?? "unknown"} finished without a downloadable ${config.artifactLabel}.`,
    );
  }

  const version = safeFilePart(build.appVersion, "unknown-version");
  const buildNumber = safeFilePart(
    build.appBuildVersion,
    safeFilePart(build.id, "unknown-build"),
  );
  const fileName = `Persimmon-${version}-build-${buildNumber}.${config.extension}`;
  const artifactPath = path.join(outputDirectory, fileName);
  const partialPath = `${artifactPath}.part`;

  await mkdir(outputDirectory, { recursive: true });
  await rm(partialPath, { force: true });
  console.log(`Downloading ${fileName}...`);
  try {
    await runStreaming("curl", [
      "--fail",
      "--location",
      "--retry",
      "3",
      "--retry-all-errors",
      "--output",
      partialPath,
      artifactUrl,
    ]);
    await runStreaming("unzip", ["-tq", partialPath]);
    if (config.platform === "android") {
      await verifyAndroidApk(partialPath);
    }
    await rename(partialPath, artifactPath);
  } catch (error) {
    await rm(partialPath, { force: true });
    throw error;
  }

  const checksum = (
    await runAndCapture("shasum", ["-a", "256", artifactPath], REPOSITORY_ROOT)
  )
    .trim()
    .split(/\s+/u)[0];
  const checksumPath = `${artifactPath}.sha256`;
  await writeFile(checksumPath, `${checksum}  ${fileName}\n`, "utf8");

  const pageUrl = buildPageUrl(build);
  console.log(`\n${config.platform} production build downloaded successfully.`);
  console.log(`${config.artifactLabel}: ${artifactPath}`);
  console.log(`SHA-256: ${checksumPath}`);
  if (pageUrl) {
    console.log(`EAS build: ${pageUrl}`);
  }
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
