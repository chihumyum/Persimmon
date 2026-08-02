import { describe, expect, it, vi } from "vitest";

import {
  AndroidGoogleDriveAuth,
  type AndroidGoogleAuthorization,
  type AndroidGoogleSignIn,
} from "./android-google-drive-auth";
import type { GoogleAuthError } from "./google-auth-types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const USER = {
  user: { email: "reader@example.com" },
};

function nativeError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function dependencies() {
  const signIn: AndroidGoogleSignIn = {
    configure: vi.fn(),
    hasPreviousSignIn: vi.fn(() => true),
    hasPlayServices: vi.fn(async () => true),
    signIn: vi.fn(async () => ({ type: "success" as const, data: USER })),
    signInSilently: vi.fn(async () => ({
      type: "success" as const,
      data: USER,
    })),
    getCurrentUser: vi.fn(() => USER),
    signOut: vi.fn(async () => null),
  };
  const authorization: AndroidGoogleAuthorization = {
    authorize: vi.fn(async () => ({
      accessToken: "drive-token",
      grantedScopes: [DRIVE_SCOPE],
    })),
    revoke: vi.fn(async () => undefined),
    clearToken: vi.fn(async () => undefined),
  };
  return { signIn, authorization };
}

function createAuth(
  values = dependencies(),
): AndroidGoogleDriveAuth & { readonly dependencies: typeof values } {
  const auth = new AndroidGoogleDriveAuth({
    ...values,
    scope: DRIVE_SCOPE,
    isConfigured: () => true,
  });
  return Object.assign(auth, { dependencies: values });
}

describe("AndroidGoogleDriveAuth", () => {
  it("uses Google Sign-In only for identity and AuthorizationClient for Drive", async () => {
    const auth = createAuth();

    await auth.connect();

    expect(auth.dependencies.signIn.configure).toHaveBeenCalledWith({
      scopes: [],
      offlineAccess: false,
    });
    expect(auth.dependencies.authorization.authorize).toHaveBeenCalledWith(
      [DRIVE_SCOPE],
      "reader@example.com",
      true,
    );
    await expect(auth.getAccessToken()).resolves.toBe("drive-token");
    expect(auth.dependencies.authorization.authorize).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated connect calls into one authorization flow", async () => {
    const values = dependencies();
    let finishAuthorization: (() => void) | undefined;
    vi.mocked(values.authorization.authorize).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishAuthorization = () =>
            resolve({
              accessToken: "drive-token",
              grantedScopes: [DRIVE_SCOPE],
            });
        }),
    );
    const auth = createAuth(values);

    const first = auth.connect();
    const second = auth.connect();

    expect(second).toBe(first);
    await vi.waitFor(() => {
      expect(values.authorization.authorize).toHaveBeenCalledTimes(1);
    });
    finishAuthorization?.();
    await Promise.all([first, second]);
    expect(values.signIn.signIn).toHaveBeenCalledTimes(1);
  });

  it("does not open consent UI during startup initialization", async () => {
    const values = dependencies();
    vi.mocked(values.authorization.authorize).mockRejectedValue(
      nativeError("E_AUTHORIZATION_REQUIRED"),
    );
    const auth = createAuth(values);

    await expect(auth.initialize()).resolves.toBe(false);
    expect(values.authorization.authorize).toHaveBeenCalledWith(
      [DRIVE_SCOPE],
      "reader@example.com",
      false,
    );
  });

  it("clears a rejected token and obtains a fresh one without legacy getTokens", async () => {
    const values = dependencies();
    vi.mocked(values.authorization.authorize)
      .mockResolvedValueOnce({
        accessToken: "expired-token",
        grantedScopes: [DRIVE_SCOPE],
      })
      .mockResolvedValueOnce({
        accessToken: "fresh-token",
        grantedScopes: [DRIVE_SCOPE],
      });
    const auth = createAuth(values);
    await auth.connect();

    await auth.invalidateAccessToken("expired-token");

    expect(values.authorization.clearToken).toHaveBeenCalledWith(
      "expired-token",
    );
    await expect(auth.getAccessToken()).resolves.toBe("fresh-token");
    expect(values.authorization.authorize).toHaveBeenLastCalledWith(
      [DRIVE_SCOPE],
      "reader@example.com",
      false,
    );
  });

  it("maps consent cancellation without losing the underlying native cause", async () => {
    const values = dependencies();
    vi.mocked(values.authorization.authorize).mockRejectedValue(
      nativeError("E_AUTHORIZATION_CANCELLED"),
    );
    const auth = createAuth(values);

    await expect(auth.connect()).rejects.toMatchObject({
      code: "authorization-cancelled",
      message: "Google Drive 授权已取消。",
    } satisfies Partial<GoogleAuthError>);
  });
});
