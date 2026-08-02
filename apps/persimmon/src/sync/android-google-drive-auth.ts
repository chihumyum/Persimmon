import { GoogleAuthError, type GoogleDriveAuth } from "./google-auth-types";

interface GoogleUser {
  readonly user: {
    readonly email: string;
  };
}

type InteractiveSignInResponse =
  | { readonly type: "success"; readonly data: GoogleUser }
  | { readonly type: "cancelled"; readonly data: null };

type SilentSignInResponse =
  | { readonly type: "success"; readonly data: GoogleUser }
  | { readonly type: "noSavedCredentialFound"; readonly data: null };

export interface AndroidGoogleSignIn {
  configure(options: {
    readonly scopes: string[];
    readonly offlineAccess: boolean;
  }): void;
  hasPreviousSignIn(): boolean;
  hasPlayServices(options: {
    readonly showPlayServicesUpdateDialog: boolean;
  }): Promise<boolean>;
  signIn(): Promise<InteractiveSignInResponse>;
  signInSilently(): Promise<SilentSignInResponse>;
  getCurrentUser(): GoogleUser | null;
  signOut(): Promise<unknown>;
}

export interface AndroidAuthorizationResult {
  readonly accessToken: string;
  readonly grantedScopes: readonly string[];
}

export interface AndroidGoogleAuthorization {
  authorize(
    scopes: readonly string[],
    accountEmail: string | null,
    interactive: boolean,
  ): Promise<AndroidAuthorizationResult>;
  revoke(scopes: readonly string[], accountEmail: string | null): Promise<void>;
  clearToken(token: string): Promise<void>;
}

interface AndroidGoogleDriveAuthOptions {
  readonly signIn: AndroidGoogleSignIn;
  readonly authorization: AndroidGoogleAuthorization;
  readonly scope: string;
  readonly isConfigured: () => boolean;
}

interface NativeModuleError extends Error {
  readonly code?: string;
}

const AUTHORIZATION_REQUIRED_CODES = new Set([
  "E_AUTHORIZATION_REQUIRED",
  "E_TOKEN_UNAVAILABLE",
]);

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as NativeModuleError).code : undefined;
}

function isAuthorizationRequired(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && AUTHORIZATION_REQUIRED_CODES.has(code);
}

function isAuthorizationCancelled(error: unknown): boolean {
  return errorCode(error) === "E_AUTHORIZATION_CANCELLED";
}

export class AndroidGoogleDriveAuth implements GoogleDriveAuth {
  private configured = false;
  private accountEmail?: string;
  private accessToken?: string;
  private activeConnection?: Promise<void>;

  constructor(private readonly options: AndroidGoogleDriveAuthOptions) {}

  isConfigured(): boolean {
    return this.options.isConfigured();
  }

  async initialize(): Promise<boolean> {
    this.configure();
    if (!this.isConfigured() || !this.options.signIn.hasPreviousSignIn()) {
      return false;
    }
    try {
      const response = await this.options.signIn.signInSilently();
      if (response.type !== "success") {
        return false;
      }
      this.accountEmail = response.data.user.email;
      const authorization = await this.options.authorization.authorize(
        [this.options.scope],
        this.accountEmail,
        false,
      );
      this.accessToken = authorization.accessToken;
      return true;
    } catch (error) {
      if (isAuthorizationRequired(error) || isAuthorizationCancelled(error)) {
        return false;
      }
      throw new GoogleAuthError(
        "authorization-required",
        "Google Drive 授权已失效，请重新连接。",
        { cause: error },
      );
    }
  }

  connect(): Promise<void> {
    if (this.activeConnection) {
      return this.activeConnection;
    }
    const connection = this.connectOnce().finally(() => {
      if (this.activeConnection === connection) {
        this.activeConnection = undefined;
      }
    });
    this.activeConnection = connection;
    return connection;
  }

  async disconnect(): Promise<void> {
    this.configure();
    const accountEmail =
      this.accountEmail ??
      this.options.signIn.getCurrentUser()?.user.email ??
      null;
    this.accessToken = undefined;
    this.accountEmail = undefined;
    try {
      await this.options.authorization.revoke(
        [this.options.scope],
        accountEmail,
      );
    } finally {
      await this.options.signIn.signOut();
    }
  }

  async getAccessToken(): Promise<string> {
    this.configure();
    if (this.accessToken) {
      return this.accessToken;
    }
    if (!this.options.signIn.hasPreviousSignIn()) {
      throw new GoogleAuthError(
        "authorization-required",
        "请先连接 Google Drive。",
      );
    }
    const accountEmail =
      this.accountEmail ??
      this.options.signIn.getCurrentUser()?.user.email ??
      null;
    try {
      const authorization = await this.options.authorization.authorize(
        [this.options.scope],
        accountEmail,
        false,
      );
      this.accessToken = authorization.accessToken;
      return authorization.accessToken;
    } catch (error) {
      throw new GoogleAuthError(
        "authorization-required",
        "Google Drive 授权已失效，请重新连接。",
        { cause: error },
      );
    }
  }

  async invalidateAccessToken(token: string): Promise<void> {
    if (this.accessToken === token) {
      this.accessToken = undefined;
    }
    await this.options.authorization.clearToken(token);
  }

  private async connectOnce(): Promise<void> {
    this.configure();
    if (!this.isConfigured()) {
      throw new GoogleAuthError(
        "unconfigured",
        "Google Drive Android OAuth Client ID 尚未配置。",
      );
    }
    try {
      await this.options.signIn.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await this.options.signIn.signIn();
      if (response.type !== "success") {
        throw new GoogleAuthError(
          "authorization-cancelled",
          "Google Drive 授权已取消。",
        );
      }
      this.accountEmail = response.data.user.email;
      const authorization = await this.options.authorization.authorize(
        [this.options.scope],
        this.accountEmail,
        true,
      );
      this.accessToken = authorization.accessToken;
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        throw error;
      }
      if (isAuthorizationCancelled(error)) {
        throw new GoogleAuthError(
          "authorization-cancelled",
          "Google Drive 授权已取消。",
          { cause: error },
        );
      }
      throw new GoogleAuthError(
        "authorization-failed",
        "无法完成 Google Drive 授权，请重试。",
        { cause: error },
      );
    }
  }

  private configure(): void {
    if (this.configured || !this.isConfigured()) {
      return;
    }
    this.options.signIn.configure({
      scopes: [],
      offlineAccess: false,
    });
    this.configured = true;
  }
}
