export const SUPPORTED_LANGUAGES = ["zh-Hans", "en"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = "zh-Hans";

export function resolveSupportedLanguage(
  languageTags: readonly (string | null | undefined)[],
): SupportedLanguage {
  for (const value of languageTags) {
    const tag = value?.trim().toLowerCase();
    if (!tag) {
      continue;
    }
    if (tag === "zh" || tag.startsWith("zh-hans") || tag.startsWith("zh-cn")) {
      return "zh-Hans";
    }
    if (tag === "en" || tag.startsWith("en-")) {
      return "en";
    }
  }
  return FALLBACK_LANGUAGE;
}
