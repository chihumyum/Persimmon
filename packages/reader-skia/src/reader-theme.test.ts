import { describe, expect, it } from "vitest";

import { resolveReaderTheme } from "./reader-theme";

describe("reader theme", () => {
  it("resolves distinct warm palettes for light and dark reading", () => {
    const light = resolveReaderTheme("warm", "light");
    const dark = resolveReaderTheme("warm", "dark");

    expect(light.name).toBe("warm");
    expect(dark.name).toBe("warm");
    expect(dark.paper).not.toBe(light.paper);
    expect(dark.text).not.toBe(light.text);
    expect(dark.surrounding).not.toBe(light.surrounding);
  });
});
