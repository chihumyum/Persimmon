import { describe, expect, it } from "vitest";

import { resolveSupportedLanguage } from "./locale";

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
