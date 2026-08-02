import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { persimmonGoogleAuthorization } from "../../modules/persimmon-google-authorization";
import { AndroidGoogleDriveAuth } from "./android-google-drive-auth";
import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  isGoogleDriveConfigured,
} from "./google-drive-config";

export const googleDriveAuth = new AndroidGoogleDriveAuth({
  signIn: GoogleSignin,
  authorization: persimmonGoogleAuthorization,
  scope: GOOGLE_DRIVE_APPDATA_SCOPE,
  isConfigured: isGoogleDriveConfigured,
});

export { GoogleAuthError, type GoogleDriveAuth } from "./google-auth-types";
