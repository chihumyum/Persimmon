export const SUPPORTED_LANGUAGES = [
  "zh-Hans",
  "zh-Hant",
  "en",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "pt-BR",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const APP_LANGUAGE_PREFERENCES = [
  "system",
  ...SUPPORTED_LANGUAGES,
] as const;

export type AppLanguagePreference = (typeof APP_LANGUAGE_PREFERENCES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = "zh-Hans";

export function resolveSupportedLanguage(
  languageTags: readonly (string | null | undefined)[],
): SupportedLanguage {
  for (const value of languageTags) {
    const tag = value?.trim().toLowerCase();
    if (!tag) {
      continue;
    }
    if (
      tag === "zh" ||
      tag.startsWith("zh-hans") ||
      tag.startsWith("zh-cn") ||
      tag.startsWith("zh-sg")
    ) {
      return "zh-Hans";
    }
    if (
      tag.startsWith("zh-hant") ||
      tag.startsWith("zh-tw") ||
      tag.startsWith("zh-hk") ||
      tag.startsWith("zh-mo")
    ) {
      return "zh-Hant";
    }
    if (tag === "en" || tag.startsWith("en-")) {
      return "en";
    }
    if (tag === "ja" || tag.startsWith("ja-")) {
      return "ja";
    }
    if (tag === "ko" || tag.startsWith("ko-")) {
      return "ko";
    }
    if (tag === "es" || tag.startsWith("es-")) {
      return "es";
    }
    if (tag === "fr" || tag.startsWith("fr-")) {
      return "fr";
    }
    if (tag === "de" || tag.startsWith("de-")) {
      return "de";
    }
    if (tag === "pt" || tag.startsWith("pt-")) {
      return "pt-BR";
    }
  }
  return FALLBACK_LANGUAGE;
}

export function resolveAppLanguage(
  preference: AppLanguagePreference,
  systemLanguageTags: readonly (string | null | undefined)[],
): SupportedLanguage {
  return preference === "system"
    ? resolveSupportedLanguage(systemLanguageTags)
    : preference;
}

export function parseAppLanguagePreference(
  value: string | null | undefined,
): AppLanguagePreference {
  return (
    APP_LANGUAGE_PREFERENCES.find((candidate) => candidate === value) ??
    "system"
  );
}
