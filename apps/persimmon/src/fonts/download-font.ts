import type {
  DownloadableFontFamily,
  FontFamilyRecord,
} from "@persimmon/font-core";

import type { FontRepository } from "./types";
import { FontRepositoryError } from "./types";

const DOWNLOAD_TIMEOUT_MS = 120_000;

async function fetchFont(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    throw new FontRepositoryError(
      "invalid-font",
      error instanceof Error && error.name === "AbortError"
        ? "字体下载超时，请检查网络后重试。"
        : "字体下载失败，请检查网络后重试。",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadFontFamily(
  family: DownloadableFontFamily,
  repository: FontRepository,
): Promise<FontFamilyRecord> {
  let installed: FontFamilyRecord | undefined;
  for (const face of family.faces) {
    const response = await fetchFont(face.url);
    if (!response.ok) {
      throw new FontRepositoryError(
        "invalid-font",
        `字体下载失败（HTTP ${response.status}）。`,
      );
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > face.byteLength) {
      throw new FontRepositoryError(
        "integrity-mismatch",
        "字体下载大小超过目录记录。",
      );
    }
    installed = await repository.installFont({
      bytes: new Uint8Array(await response.arrayBuffer()),
      source: "downloaded",
      familyId: family.id,
      faceId: face.id,
      displayName: family.displayName,
      license: family.license,
      expectedSha256: face.sha256,
      expectedByteLength: face.byteLength,
    });
  }
  if (!installed) {
    throw new FontRepositoryError("invalid-font", "字体目录中没有可下载文件。");
  }
  return installed;
}
