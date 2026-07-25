import { describe, expect, it } from "vitest";
import { strToU8 } from "fflate";

import { detectImageSize } from "./image-dimensions";

describe("detectImageSize", () => {
  it("reads PNG and GIF dimensions without decoding pixels", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47], 0);
    png.set(strToU8("IHDR"), 12);
    new DataView(png.buffer).setUint32(16, 1200);
    new DataView(png.buffer).setUint32(20, 800);
    expect(detectImageSize(png, "image/png")).toEqual({
      width: 1200,
      height: 800,
    });

    const gif = strToU8("GIF89a0000");
    gif[6] = 0x80;
    gif[7] = 0x02;
    gif[8] = 0xe0;
    gif[9] = 0x01;
    expect(detectImageSize(gif, "image/gif")).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("uses SVG dimensions or viewBox as a safe fallback", () => {
    expect(
      detectImageSize(
        strToU8('<svg viewBox="0 0 1440 900"></svg>'),
        "image/svg+xml",
      ),
    ).toEqual({ width: 1440, height: 900 });
  });
});
