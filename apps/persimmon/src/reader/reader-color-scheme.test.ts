import { describe, expect, it } from "vitest";

import { resolveReaderColorScheme } from "./reader-color-mode";

describe("resolveReaderColorScheme", () => {
  it("follows the live system scheme only in automatic mode", () => {
    expect(resolveReaderColorScheme("system", "light")).toBe("light");
    expect(resolveReaderColorScheme("system", "dark")).toBe("dark");
    expect(resolveReaderColorScheme("light", "dark")).toBe("light");
    expect(resolveReaderColorScheme("dark", "light")).toBe("dark");
  });
});
