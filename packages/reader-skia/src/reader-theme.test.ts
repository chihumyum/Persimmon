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

  it("resolves neutral cool-white paper without a blue hue", () => {
    const warm = resolveReaderTheme("warm", "light");
    const cool = resolveReaderTheme("cool", "light");
    const coolDark = resolveReaderTheme("cool", "dark");

    expect(cool.name).toBe("cool");
    expect(cool.paper).toBe("#f7f7f7");
    expect(coolDark.paper).toBe("#1c1c1c");
    expect(cool.paper).not.toBe(warm.paper);
    expect(cool.surrounding).not.toBe(warm.surrounding);
    expect(cool.accent).toBe(warm.accent);
    expect(cool.accent).toBe("#d95f2b");

    for (const theme of [cool, coolDark]) {
      for (const color of [
        theme.paper,
        theme.surrounding,
        theme.text,
        theme.decoration,
        theme.divider,
        theme.imagePlaceholder,
        theme.panel,
        theme.panelRaised,
        theme.panelMuted,
        theme.border,
        theme.controlText,
        theme.secondaryText,
        theme.shadow,
      ]) {
        const [, red, green, blue] =
          /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)!;
        expect(red).toBe(green);
        expect(green).toBe(blue);
      }
    }
  });
});
