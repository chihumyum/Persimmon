import { getLocales } from "expo-localization";

import { activeLanguage, i18n } from ".";
import {
  FALLBACK_LANGUAGE,
  resolveAppLanguage,
  type AppLanguagePreference,
  type SupportedLanguage,
} from "./locale";

function systemLanguage(): SupportedLanguage {
  try {
    return resolveAppLanguage(
      "system",
      getLocales().map((locale) => locale.languageTag),
    );
  } catch {
    return FALLBACK_LANGUAGE;
  }
}

export function syncAppLanguage(
  preference: AppLanguagePreference,
): Promise<unknown> | undefined {
  const next = preference === "system" ? systemLanguage() : preference;
  if (activeLanguage() === next) {
    return undefined;
  }
  return i18n.changeLanguage(next);
}
