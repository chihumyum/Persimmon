import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_BANNER_VISIBLE_KEY = "@persimmon/library/sync-banner-visible/v1";

export async function loadSyncBannerVisible(): Promise<boolean> {
  return (await AsyncStorage.getItem(SYNC_BANNER_VISIBLE_KEY)) !== "false";
}

export async function saveSyncBannerVisible(visible: boolean): Promise<void> {
  await AsyncStorage.setItem(SYNC_BANNER_VISIBLE_KEY, String(visible));
}
