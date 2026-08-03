import type { GoogleDriveAuth } from "./google-auth-types";
import type { CloudAccount } from "./types";

const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_ROOT = "https://www.googleapis.com/upload/drive/v3";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface DriveFileMetadata {
  readonly id: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly size?: string;
  readonly modifiedTime?: string;
}

interface DriveFileList {
  readonly nextPageToken?: string;
  readonly files?: readonly DriveFileMetadata[];
}

interface DriveAbout {
  readonly user?: {
    readonly displayName?: string;
    readonly emailAddress?: string;
    readonly permissionId?: string;
  };
}

export class DriveApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DriveApiError";
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function responseError(response: Response): Promise<DriveApiError> {
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 800);
  } catch {
    // The status code still gives the caller a stable error category.
  }
  return new DriveApiError(
    response.status,
    detail
      ? `Google Drive 请求失败 (${response.status})：${detail}`
      : `Google Drive 请求失败 (${response.status})。`,
  );
}

export class GoogleDriveClient {
  constructor(private readonly auth: GoogleDriveAuth) {}

  async getAccount(): Promise<CloudAccount> {
    const response = await this.request(
      `${DRIVE_API_ROOT}/about?fields=user(displayName,emailAddress,permissionId)`,
    );
    if (!response.ok) {
      throw await responseError(response);
    }
    const about = (await response.json()) as DriveAbout;
    const user = about.user;
    const id = user?.permissionId ?? user?.emailAddress;
    if (!id) {
      throw new Error("Google Drive 未返回可识别的账户信息。");
    }
    return {
      id,
      ...(user?.emailAddress ? { email: user.emailAddress } : {}),
      ...(user?.displayName ? { displayName: user.displayName } : {}),
    };
  }

  async listAppDataFiles(): Promise<readonly DriveFileMetadata[]> {
    const files: DriveFileMetadata[] = [];
    let pageToken: string | undefined;
    do {
      const parameters = new URLSearchParams({
        spaces: "appDataFolder",
        pageSize: "1000",
        q: "trashed = false",
        fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      });
      if (pageToken) {
        parameters.set("pageToken", pageToken);
      }
      const response = await this.request(
        `${DRIVE_API_ROOT}/files?${parameters.toString()}`,
      );
      if (!response.ok) {
        throw await responseError(response);
      }
      const page = (await response.json()) as DriveFileList;
      files.push(...(page.files ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  async downloadFile(fileId: string): Promise<Uint8Array> {
    const response = await this.request(
      `${DRIVE_API_ROOT}/files/${encodeURIComponent(fileId)}?alt=media`,
    );
    if (!response.ok) {
      throw await responseError(response);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await this.request(
      `${DRIVE_API_ROOT}/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
    );
    if (!response.ok && response.status !== 404) {
      throw await responseError(response);
    }
  }

  async uploadResumable(
    name: string,
    mimeType: string,
    bytes: Uint8Array,
    existingFileId?: string,
  ): Promise<DriveFileMetadata> {
    const filePath = existingFileId
      ? `/files/${encodeURIComponent(existingFileId)}`
      : "/files";
    const parameters = new URLSearchParams({
      uploadType: "resumable",
      fields: "id,name,mimeType,size,modifiedTime",
    });
    const metadata = existingFileId
      ? { name, mimeType }
      : { name, mimeType, parents: ["appDataFolder"] };
    const initiation = await this.request(
      `${DRIVE_UPLOAD_ROOT}${filePath}?${parameters.toString()}`,
      {
        method: existingFileId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(bytes.byteLength),
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!initiation.ok) {
      throw await responseError(initiation);
    }
    const sessionUrl = initiation.headers.get("location");
    if (!sessionUrl) {
      throw new Error("Google Drive 未返回 resumable upload 地址。");
    }

    // React Native's Blob constructor rejects ArrayBufferView parts on both
    // iOS and Android, while its networking layer supports ArrayBuffer bodies.
    // Copy the bytes so the request owns an exact-length, reusable buffer.
    const body = Uint8Array.from(bytes).buffer;
    const upload = await this.request(sessionUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body,
    });
    if (!upload.ok) {
      throw await responseError(upload);
    }
    return (await upload.json()) as DriveFileMetadata;
  }

  private async request(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    let authorizationRetried = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const token = await this.auth.getAccessToken();
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init.headers).entries()),
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        if (attempt === 3) {
          throw new Error("无法连接 Google Drive，请检查网络后重试。", {
            cause: error,
          });
        }
        await delay(250 * 2 ** attempt);
        continue;
      }

      if (response.status === 401 && !authorizationRetried) {
        authorizationRetried = true;
        await this.auth.invalidateAccessToken(token);
        continue;
      }
      if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
        await delay(250 * 2 ** attempt);
        continue;
      }
      return response;
    }
    throw new Error("Google Drive 请求重试次数已用尽。");
  }
}
