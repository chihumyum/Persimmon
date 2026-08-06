import { afterEach, describe, expect, it } from "vitest";

import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from "./locale";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { ptBR } from "./locales/pt-BR";
import { zhHans } from "./locales/zh-Hans";
import { zhHant } from "./locales/zh-Hant";
import { i18n, translate } from ".";

interface TranslationObject {
  readonly [key: string]: string | TranslationObject;
}

function flattenTranslations(
  value: TranslationObject,
  prefix = "",
): Map<string, string> {
  const flattened = new Map<string, string>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      flattened.set(path, child);
    } else {
      for (const [childPath, childValue] of flattenTranslations(child, path)) {
        flattened.set(childPath, childValue);
      }
    }
  }
  return flattened;
}

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/\{\{[^}]+\}\}/g)].map(([token]) => token).sort();
}

const bundledLanguages = {
  de,
  en,
  es,
  fr,
  ja,
  ko,
  "pt-BR": ptBR,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
} as const;

describe("bundled translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage(FALLBACK_LANGUAGE);
  });

  it("renders Simplified Chinese by default", () => {
    expect(translate("library.empty.title")).toBe("这里还没有书");
  });

  it("switches to English and interpolates values", async () => {
    await i18n.changeLanguage("en");

    expect(translate("library.empty.title")).toBe("No books here yet");
    expect(
      translate("reader.accessibility.header", { title: "Chapter One" }),
    ).toBe("Header: Chapter One");
  });

  it("switches to a newly bundled language", async () => {
    await i18n.changeLanguage("ja");

    expect(translate("library.empty.title")).toBe("まだ本はありません");
  });

  it("bundles a resource for every supported language", () => {
    expect(Object.keys(bundledLanguages).sort()).toEqual(
      [...SUPPORTED_LANGUAGES].sort(),
    );
  });

  it.each(Object.entries(bundledLanguages))(
    "%s has every translation key and preserves interpolation tokens",
    (_language, resource) => {
      const reference = flattenTranslations(en as unknown as TranslationObject);
      const candidate = flattenTranslations(
        resource as unknown as TranslationObject,
      );

      expect([...candidate.keys()].sort()).toEqual(
        [...reference.keys()].sort(),
      );
      for (const [key, referenceValue] of reference) {
        const candidateValue = candidate.get(key);
        expect(candidateValue, key).toBeTruthy();
        expect(interpolationTokens(candidateValue ?? ""), key).toEqual(
          interpolationTokens(referenceValue),
        );
      }
    },
  );
});
