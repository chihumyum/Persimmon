import i18next, { type TOptions } from "i18next";
import { initReactI18next } from "react-i18next";

import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { ptBR } from "./locales/pt-BR";
import { zhHans } from "./locales/zh-Hans";
import { zhHant } from "./locales/zh-Hant";
import {
  FALLBACK_LANGUAGE,
  resolveSupportedLanguage,
  type SupportedLanguage,
} from "./locale";

void i18next.use(initReactI18next).init({
  fallbackLng: FALLBACK_LANGUAGE,
  initAsync: false,
  interpolation: { escapeValue: false },
  lng: FALLBACK_LANGUAGE,
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    ja: { translation: ja },
    ko: { translation: ko },
    "pt-BR": { translation: ptBR },
    "zh-Hans": { translation: zhHans },
    "zh-Hant": { translation: zhHant },
  },
  returnNull: false,
});

export function activeLanguage(): SupportedLanguage {
  return resolveSupportedLanguage([i18next.resolvedLanguage, i18next.language]);
}

export function translate(key: string, options?: TOptions): string {
  const untypedTranslate = i18next.t as (
    translationKey: string,
    translationOptions?: TOptions,
  ) => string;
  return untypedTranslate(key, options);
}

export function formatDate(
  value: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(activeLanguage(), options).format(value);
}

export function formatTime(value: Date): string {
  return formatDate(value, { hour: "2-digit", minute: "2-digit" });
}

export function formatByteCount(byteLength: number): string {
  const formatter = new Intl.NumberFormat(activeLanguage(), {
    maximumFractionDigits: 1,
  });
  if (byteLength < 1024) {
    return `${formatter.format(byteLength)} B`;
  }
  if (byteLength < 1024 * 1024) {
    return `${formatter.format(byteLength / 1024)} KB`;
  }
  return `${formatter.format(byteLength / (1024 * 1024))} MB`;
}

export function formatPercentage(percentage: number): string {
  return new Intl.NumberFormat(activeLanguage(), {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(percentage / 100);
}

export { default as i18n } from "i18next";
export type { AppLanguagePreference, SupportedLanguage } from "./locale";
