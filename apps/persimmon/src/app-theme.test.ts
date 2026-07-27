import { describe, expect, it } from "vitest";

import { DEFAULT_READER_APPEARANCE } from "./library/types";
import { resolveAppColorScheme, resolveAppTheme } from "./app-theme";

describe("app theme", () => {
  it("follows live system appearance in automatic mode", () => {
    expect(resolveAppColorScheme("system", "light")).toBe("light");
    expect(resolveAppColorScheme("system", "dark")).toBe("dark");

    const light = resolveAppTheme(DEFAULT_READER_APPEARANCE, "light");
    const dark = resolveAppTheme(DEFAULT_READER_APPEARANCE, "dark");

    expect(light.colorScheme).toBe("light");
    expect(dark.colorScheme).toBe("dark");
    expect(dark.paper).not.toBe(light.paper);
    expect(dark.text).not.toBe(light.text);
  });

  it("keeps an explicit reader color mode independent of the system", () => {
    expect(resolveAppColorScheme("light", "dark")).toBe("light");
    expect(resolveAppColorScheme("dark", "light")).toBe("dark");
  });
});
