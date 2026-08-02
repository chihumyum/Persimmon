import { getLocales } from "expo-localization";

import { activeLanguage, i18n } from ".";
import {
  FALLBACK_LANGUAGE,
  resolveSupportedLanguage,
  type SupportedLanguage,
} from "./locale";

function systemLanguage(): SupportedLanguage {
  try {
    return resolveSupportedLanguage(
      getLocales().map((locale) => locale.languageTag),
    );
  } catch {
    return FALLBACK_LANGUAGE;
  }
}

export function syncSystemLanguage(): Promise<unknown> | undefined {
  const next = systemLanguage();
  if (activeLanguage() === next) {
    return undefined;
  }
  return i18n.changeLanguage(next);
}
