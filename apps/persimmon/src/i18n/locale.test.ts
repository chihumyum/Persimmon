import { describe, expect, it } from "vitest";

import {
  parseAppLanguagePreference,
  resolveAppLanguage,
  resolveSupportedLanguage,
} from "./locale";

describe("resolveSupportedLanguage", () => {
  it("matches Simplified Chinese language and region tags", () => {
    expect(resolveSupportedLanguage(["zh-Hans-CN"])).toBe("zh-Hans");
    expect(resolveSupportedLanguage(["zh-CN"])).toBe("zh-Hans");
    expect(resolveSupportedLanguage(["zh-SG"])).toBe("zh-Hans");
  });

  it("matches Traditional Chinese language and region tags", () => {
    expect(resolveSupportedLanguage(["zh-Hant-HK"])).toBe("zh-Hant");
    expect(resolveSupportedLanguage(["zh-TW"])).toBe("zh-Hant");
  });

  it("matches common language region variants", () => {
    expect(resolveSupportedLanguage(["ja-JP"])).toBe("ja");
    expect(resolveSupportedLanguage(["ko-KR"])).toBe("ko");
    expect(resolveSupportedLanguage(["es-MX"])).toBe("es");
    expect(resolveSupportedLanguage(["fr-CA"])).toBe("fr");
    expect(resolveSupportedLanguage(["de-AT"])).toBe("de");
    expect(resolveSupportedLanguage(["pt-PT"])).toBe("pt-BR");
  });

  it("uses the first supported language in the preference list", () => {
    expect(resolveSupportedLanguage(["it-IT", "en-GB", "zh-CN"])).toBe("en");
  });

  it("falls back to Simplified Chinese", () => {
    expect(resolveSupportedLanguage(["it-IT"])).toBe("zh-Hans");
  });
});

describe("app language override", () => {
  it("uses the current system language in automatic mode", () => {
    expect(resolveAppLanguage("system", ["en-US"])).toBe("en");
  });

  it("keeps an explicit override regardless of system language", () => {
    expect(resolveAppLanguage("zh-Hans", ["en-US"])).toBe("zh-Hans");
    expect(resolveAppLanguage("en", ["zh-CN"])).toBe("en");
    expect(resolveAppLanguage("ja", ["zh-CN"])).toBe("ja");
  });

  it("treats invalid stored preferences as automatic", () => {
    expect(parseAppLanguagePreference("it")).toBe("system");
  });
});
