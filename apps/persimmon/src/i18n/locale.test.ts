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
  });

  it("uses the first supported language in the preference list", () => {
    expect(resolveSupportedLanguage(["fr-FR", "en-GB", "zh-CN"])).toBe("en");
  });

  it("falls back to Simplified Chinese", () => {
    expect(resolveSupportedLanguage(["fr-FR"])).toBe("zh-Hans");
  });
});

describe("app language override", () => {
  it("uses the current system language in automatic mode", () => {
    expect(resolveAppLanguage("system", ["en-US"])).toBe("en");
  });

  it("keeps an explicit override regardless of system language", () => {
    expect(resolveAppLanguage("zh-Hans", ["en-US"])).toBe("zh-Hans");
    expect(resolveAppLanguage("en", ["zh-CN"])).toBe("en");
  });

  it("treats invalid stored preferences as automatic", () => {
    expect(parseAppLanguagePreference("fr")).toBe("system");
  });
});
