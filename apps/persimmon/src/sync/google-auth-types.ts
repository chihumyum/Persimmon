export type GoogleAuthErrorCode =
  | "unconfigured"
  | "authorization-required"
  | "authorization-cancelled"
  | "authorization-failed";

export class GoogleAuthError extends Error {
  constructor(
    readonly code: GoogleAuthErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GoogleAuthError";
  }
}

export interface GoogleDriveAuth {
  isConfigured(): boolean;
  initialize(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccessToken(): Promise<string>;
  invalidateAccessToken(token: string): Promise<void>;
}
