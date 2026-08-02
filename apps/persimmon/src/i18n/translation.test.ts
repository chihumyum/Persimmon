import { afterEach, describe, expect, it } from "vitest";

import { FALLBACK_LANGUAGE } from "./locale";
import { i18n, translate } from ".";

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
});
