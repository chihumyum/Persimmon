import { requireNativeModule } from "expo";

export interface GoogleAuthorizationResult {
  readonly accessToken: string;
  readonly grantedScopes: readonly string[];
}

interface PersimmonGoogleAuthorizationNativeModule {
  authorize(
    scopes: readonly string[],
    accountEmail: string | null,
    interactive: boolean,
  ): Promise<GoogleAuthorizationResult>;
  revoke(scopes: readonly string[], accountEmail: string | null): Promise<void>;
  clearToken(token: string): Promise<void>;
}

export const persimmonGoogleAuthorization =
  requireNativeModule<PersimmonGoogleAuthorizationNativeModule>(
    "PersimmonGoogleAuthorization",
  );
