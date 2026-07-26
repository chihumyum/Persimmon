import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  googleDrivePublicConfig,
  isGoogleDriveConfigured,
} from "./google-drive-config";
import { GoogleAuthError, type GoogleDriveAuth } from "./google-auth-types";

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const SESSION_TOKEN_KEY = "persimmon-google-drive-access-token-v1";

interface StoredWebToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

interface GoogleTokenResponse {
  readonly access_token?: string;
  readonly expires_in?: number | string;
  readonly error?: string;
  readonly error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { readonly prompt?: string }): void;
}

interface GoogleIdentityServices {
  readonly accounts: {
    readonly oauth2: {
      initTokenClient(config: {
        readonly client_id: string;
        readonly scope: string;
        readonly include_granted_scopes: boolean;
        readonly callback: (response: GoogleTokenResponse) => void;
        readonly error_callback: (error: {
          readonly type?: string;
          readonly message?: string;
        }) => void;
      }): GoogleTokenClient;
      revoke(accessToken: string, callback: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let scriptPromise: Promise<void> | undefined;

function ensureGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google 网页授权只能在浏览器中使用。"));
  }
  if (window.google?.accounts.oauth2) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    document
      .querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`)
      ?.remove();
    const script = document.createElement("script");
    const onLoad = () => resolve();
    const onError = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error("无法加载 Google 授权服务。"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    document.head.append(script);
  });
  return scriptPromise;
}

function loadStoredToken(): StoredWebToken | undefined {
  try {
    if (typeof sessionStorage === "undefined") {
      return undefined;
    }
    const serialized = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!serialized) {
      return undefined;
    }
    const value = JSON.parse(serialized) as Partial<StoredWebToken>;
    if (
      typeof value.accessToken === "string" &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > Date.now() + 30_000
    ) {
      return {
        accessToken: value.accessToken,
        expiresAt: value.expiresAt,
      };
    }
  } catch {
    // Invalid session data is equivalent to a signed-out browser tab.
  }
  removeStoredToken();
  return undefined;
}

function saveStoredToken(token: StoredWebToken): void {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(token));
  } catch {
    // The in-memory token remains usable when browser storage is unavailable.
  }
}

function removeStoredToken(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // There may be no writable session storage in hardened browser contexts.
  }
}

class WebGoogleDriveAuth implements GoogleDriveAuth {
  private token = loadStoredToken();

  isConfigured(): boolean {
    return isGoogleDriveConfigured();
  }

  async initialize(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    this.token = loadStoredToken();
    void ensureGoogleIdentityServices().catch(() => undefined);
    return Boolean(this.token);
  }

  async connect(): Promise<void> {
    const clientId = googleDrivePublicConfig.webClientId;
    if (!this.isConfigured() || !clientId) {
      throw new GoogleAuthError(
        "unconfigured",
        "Google Drive Web OAuth Client ID 尚未配置。",
      );
    }
    try {
      await ensureGoogleIdentityServices();
    } catch (error) {
      throw new GoogleAuthError(
        "authorization-failed",
        "无法加载 Google 授权服务，请检查网络后重试。",
        { cause: error },
      );
    }
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) {
      throw new GoogleAuthError(
        "authorization-failed",
        "Google 授权服务未正确加载。",
      );
    }

    this.token = await new Promise<StoredWebToken>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_APPDATA_SCOPE,
        include_granted_scopes: true,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(
              new GoogleAuthError(
                response.error === "access_denied"
                  ? "authorization-cancelled"
                  : "authorization-failed",
                response.error_description ??
                  "Google Drive 授权未完成，请重试。",
              ),
            );
            return;
          }
          const expiresIn = Number(response.expires_in ?? 3600);
          resolve({
            accessToken: response.access_token,
            expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
          });
        },
        error_callback: (error) => {
          reject(
            new GoogleAuthError(
              error.type === "popup_closed"
                ? "authorization-cancelled"
                : "authorization-failed",
              error.message ?? "Google 授权窗口未能完成。",
            ),
          );
        },
      });
      client.requestAccessToken({ prompt: "consent" });
    });
    saveStoredToken(this.token);
  }

  async disconnect(): Promise<void> {
    const token = this.token?.accessToken;
    this.token = undefined;
    removeStoredToken();
    if (!token) {
      return;
    }
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) {
      return;
    }
    await new Promise<void>((resolve) => oauth2.revoke(token, resolve));
  }

  async getAccessToken(): Promise<string> {
    const token = this.token ?? loadStoredToken();
    if (!token || token.expiresAt <= Date.now() + 30_000) {
      this.token = undefined;
      removeStoredToken();
      throw new GoogleAuthError(
        "authorization-required",
        "Google 网页授权已过期，请重新连接后继续同步。",
      );
    }
    this.token = token;
    return token.accessToken;
  }

  async invalidateAccessToken(token: string): Promise<void> {
    if (this.token?.accessToken === token) {
      this.token = undefined;
      removeStoredToken();
    }
  }
}

export const googleDriveAuth: GoogleDriveAuth = new WebGoogleDriveAuth();

export { GoogleAuthError, type GoogleDriveAuth } from "./google-auth-types";
