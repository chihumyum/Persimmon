import { describe, expect, it } from "vitest";

import type { ReaderAppearance } from "./reader-appearance";
import { createReaderLayoutSpec } from "./reader-layout-spec";

const appearance: ReaderAppearance = {
  fontFamily: "Noto Sans SC",
  fontSize: 24,
  lineHeight: 1.8,
  paragraphSpacing: 1.2,
  horizontalMargin: 44,
  progressDisplay: "both",
};

describe("reader pagination style", () => {
  it("maps reader appearance to deterministic typography and spacing", () => {
    const spec = createReaderLayoutSpec(400, 800, appearance);

    expect(spec.padding).toEqual({
      top: 52,
      right: 44,
      bottom: 52,
      left: 44,
    });
    expect(spec.body).toMatchObject({
      fontFamilies: ["Noto Sans SC", "Noto Sans Math"],
      fontSize: 24,
      heightMultiplier: 1.8,
    });
    expect(spec.note).toMatchObject({
      fontFamilies: ["Noto Sans SC", "Noto Sans Math"],
      fontSize: 20.4,
    });
    expect(spec.headings[1]).toMatchObject({
      fontFamilies: ["Noto Sans SC", "Noto Sans Math"],
      fontSize: 40.8,
    });
    expect(spec.paragraphGap).toBeCloseTo(28.8);
    expect(spec.paragraphGapMode).toBe("reader");
  });

  it("reserves safe-area space and keeps a readable narrow content column", () => {
    const spec = createReaderLayoutSpec(
      160,
      800,
      { ...appearance, horizontalMargin: 72 },
      47,
      34,
    );

    expect(spec.padding).toEqual({
      top: 81,
      right: 32,
      bottom: 68,
      left: 32,
    });
  });
});
