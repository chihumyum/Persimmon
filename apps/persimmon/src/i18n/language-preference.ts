import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  parseAppLanguagePreference,
  type AppLanguagePreference,
} from "./locale";

const APP_LANGUAGE_PREFERENCE_KEY = "@persimmon/app-language/v1";

let pendingWrite: Promise<void> = Promise.resolve();

export async function loadAppLanguagePreference(): Promise<AppLanguagePreference> {
  return parseAppLanguagePreference(
    await AsyncStorage.getItem(APP_LANGUAGE_PREFERENCE_KEY),
  );
}

export function saveAppLanguagePreference(
  preference: AppLanguagePreference,
): Promise<void> {
  const write = pendingWrite.then(() =>
    AsyncStorage.setItem(APP_LANGUAGE_PREFERENCE_KEY, preference),
  );
  pendingWrite = write.catch(() => undefined);
  return write;
}
