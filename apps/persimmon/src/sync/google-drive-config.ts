import Constants from "expo-constants";
import { Platform } from "react-native";

export const GOOGLE_DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";

interface GoogleDrivePublicConfig {
  readonly webClientId?: string;
  readonly iosClientId?: string;
  readonly androidClientId?: string;
}

function readConfig(): GoogleDrivePublicConfig {
  const value = Constants.expoConfig?.extra?.googleDrive;
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const config = value as Record<string, unknown>;
  return {
    ...(typeof config.webClientId === "string"
      ? { webClientId: config.webClientId }
      : {}),
    ...(typeof config.iosClientId === "string"
      ? { iosClientId: config.iosClientId }
      : {}),
    ...(typeof config.androidClientId === "string"
      ? { androidClientId: config.androidClientId }
      : {}),
  };
}

function hasClientId(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(value) &&
      !value.includes("REPLACE"),
  );
}

export const googleDrivePublicConfig = readConfig();

export function isGoogleDriveConfigured(): boolean {
  switch (Platform.OS) {
    case "web":
      return hasClientId(googleDrivePublicConfig.webClientId);
    case "ios":
      return hasClientId(googleDrivePublicConfig.iosClientId);
    case "android":
      return hasClientId(googleDrivePublicConfig.androidClientId);
    default:
      return false;
  }
}

export function googleDriveConfigurationMessage(): string {
  switch (Platform.OS) {
    case "web":
      return "Google Drive 尚未配置 Web OAuth Client ID。";
    case "ios":
      return "Google Drive 尚未配置 iOS OAuth Client ID。";
    case "android":
      return "Google Drive 尚未配置 Android OAuth Client ID。";
    default:
      return "当前平台不支持 Google Drive 同步。";
  }
}
