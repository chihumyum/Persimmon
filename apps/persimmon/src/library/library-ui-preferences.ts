import AsyncStorage from "@react-native-async-storage/async-storage";

const GOOGLE_DRIVE_PROMPT_DISMISSED_KEY =
  "@persimmon/library/google-drive-prompt-dismissed/v1";
const LEGACY_SYNC_BANNER_VISIBLE_KEY =
  "@persimmon/library/sync-banner-visible/v1";
const BOOK_METADATA_VISIBLE_KEY = "@persimmon/library/book-metadata-visible/v1";

export async function loadBookMetadataVisible(): Promise<boolean> {
  return (await AsyncStorage.getItem(BOOK_METADATA_VISIBLE_KEY)) !== "false";
}

export async function saveBookMetadataVisible(visible: boolean): Promise<void> {
  await AsyncStorage.setItem(BOOK_METADATA_VISIBLE_KEY, String(visible));
}

export async function loadGoogleDrivePromptDismissed(): Promise<boolean> {
  const dismissed = await AsyncStorage.getItem(
    GOOGLE_DRIVE_PROMPT_DISMISSED_KEY,
  );
  if (dismissed !== null) {
    return dismissed === "true";
  }

  // Preserve the old setting: users who disabled shelf sync notices should
  // not see the new connection prompt after upgrading.
  return (
    (await AsyncStorage.getItem(LEGACY_SYNC_BANNER_VISIBLE_KEY)) === "false"
  );
}

export async function dismissGoogleDrivePrompt(): Promise<void> {
  await AsyncStorage.setItem(GOOGLE_DRIVE_PROMPT_DISMISSED_KEY, "true");
}
