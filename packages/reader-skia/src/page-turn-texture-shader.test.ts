import { describe, expect, it } from "vitest";

import {
  nativePageTextureShader,
  nativePaperEffectKey,
  pageTurnPaperEffectKey,
  pageTurnPaperShader,
} from "./page-turn-texture-shader";
import { DEFAULT_READER_THEME, resolveReaderTheme } from "./reader-theme";

describe("single-page turn texture shaders", () => {
  it("paints the native underside as themed blank stock without a texture fetch", () => {
    const paperColor = resolveReaderTheme("warm", "dark").paper;
    const shader = nativePageTextureShader("both", false, paperColor);

    expect(shader).toContain("uniform shader frontTexture;");
    expect(shader).not.toContain("backTexture");
    expect(shader.match(/\.eval\(/g)).toHaveLength(1);
    expect(shader).toContain(shaderPaperLiteral(paperColor));
    expect(shader).not.toContain("1.0 - visible.x");
  });

  it("does the same for the Web lookup renderer", () => {
    const paperColor = DEFAULT_READER_THEME.paper;
    const shader = pageTurnPaperShader(64, false, "both", paperColor);

    expect(shader).toContain("uniform shader paperTexture;");
    expect(shader).not.toContain("backTexture");
    expect(shader.match(/\.eval\(/g)).toHaveLength(1);
    expect(shader).toContain(shaderPaperLiteral(paperColor));
    expect(shader).not.toContain("1.0 - material");
  });

  it("keys themed one-sided effects separately", () => {
    const darkPaper = resolveReaderTheme("warm", "dark").paper;

    expect(nativePaperEffectKey("both", false, darkPaper)).not.toBe(
      nativePaperEffectKey("both", false, DEFAULT_READER_THEME.paper),
    );
    expect(pageTurnPaperEffectKey(64, false, "both", darkPaper)).not.toBe(
      pageTurnPaperEffectKey(64, false, "both", DEFAULT_READER_THEME.paper),
    );
  });
});

describe("spread turn texture shaders", () => {
  it("keeps both real page textures on native and Web", () => {
    const native = nativePageTextureShader("both", true);
    const web = pageTurnPaperShader(64, true, "both");

    expect(native).toContain("uniform shader backTexture;");
    expect(native).toContain("backTexture.eval(source)");
    expect(native).toContain("visible.w > 0.0 ? visible.x : 1.0 - visible.x");
    expect(web).toContain("uniform shader backTexture;");
    expect(web).toContain("backTexture.eval");
    expect(web).toContain("(1.0 - material) * backImageSize.x");
  });
});

function shaderPaperLiteral(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const channel = (index: number) =>
    (Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16) / 255).toFixed(6);
  return `half3(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}
