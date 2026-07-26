import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  googleDrivePublicConfig,
  isGoogleDriveConfigured,
} from "./google-drive-config";
import { GoogleAuthError, type GoogleDriveAuth } from "./google-auth-types";

class NativeGoogleDriveAuth implements GoogleDriveAuth {
  private configured = false;

  isConfigured(): boolean {
    return isGoogleDriveConfigured();
  }

  async initialize(): Promise<boolean> {
    this.configure();
    if (!this.isConfigured() || !GoogleSignin.hasPreviousSignIn()) {
      return false;
    }
    try {
      const response = await GoogleSignin.signInSilently();
      return response.type === "success";
    } catch (error) {
      throw new GoogleAuthError(
        "authorization-required",
        "Google Drive 授权已失效，请重新连接。",
        { cause: error },
      );
    }
  }

  async connect(): Promise<void> {
    this.configure();
    if (!this.isConfigured()) {
      throw new GoogleAuthError(
        "unconfigured",
        `Google Drive ${Platform.OS} OAuth Client ID 尚未配置。`,
      );
    }
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        return;
      }
      throw new GoogleAuthError(
        "authorization-cancelled",
        "Google Drive 授权已取消。",
      );
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        throw error;
      }
      throw new GoogleAuthError(
        "authorization-failed",
        "无法完成 Google Drive 授权，请重试。",
        { cause: error },
      );
    }
  }

  async disconnect(): Promise<void> {
    this.configure();
    try {
      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.revokeAccess();
      }
    } finally {
      await GoogleSignin.signOut();
    }
  }

  async getAccessToken(): Promise<string> {
    this.configure();
    if (!GoogleSignin.hasPreviousSignIn()) {
      throw new GoogleAuthError(
        "authorization-required",
        "请先连接 Google Drive。",
      );
    }
    try {
      return (await GoogleSignin.getTokens()).accessToken;
    } catch (error) {
      throw new GoogleAuthError(
        "authorization-required",
        "Google Drive 授权已失效，请重新连接。",
        { cause: error },
      );
    }
  }

  async invalidateAccessToken(token: string): Promise<void> {
    if (Platform.OS === "android") {
      await GoogleSignin.clearCachedAccessToken(token);
    }
  }

  private configure(): void {
    if (this.configured || !this.isConfigured()) {
      return;
    }
    GoogleSignin.configure({
      scopes: [GOOGLE_DRIVE_APPDATA_SCOPE],
      offlineAccess: false,
      ...(googleDrivePublicConfig.iosClientId
        ? { iosClientId: googleDrivePublicConfig.iosClientId }
        : {}),
    });
    this.configured = true;
  }
}

export const googleDriveAuth: GoogleDriveAuth = new NativeGoogleDriveAuth();

export { GoogleAuthError, type GoogleDriveAuth } from "./google-auth-types";
