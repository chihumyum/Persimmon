import { describe, expect, it, vi } from "vitest";

import {
  bindNativePagerInput,
  nativePagerTapNeedsRNFallback,
} from "./native-pager-input";

describe("native pager input binding", () => {
  it("cleans up the canvas that was originally configured", () => {
    const configure = vi.fn();
    const oldCanvas = { id: 1 };
    const newCanvas = { id: 2 };

    const cleanUpOldCanvas = bindNativePagerInput(oldCanvas, true, configure);
    bindNativePagerInput(newCanvas, true, configure);
    cleanUpOldCanvas();

    expect(configure.mock.calls).toEqual([
      [oldCanvas, true],
      [newCanvas, true],
      [oldCanvas, false],
    ]);
  });
});

describe("native pager tap fallback", () => {
  it.each([
    { enabled: false, result: undefined, expected: true },
    { enabled: true, result: undefined, expected: true },
    { enabled: true, result: false, expected: true },
    { enabled: true, result: true, expected: false },
  ])(
    "returns $expected when enabled=$enabled and result=$result",
    ({ enabled, result, expected }) => {
      expect(nativePagerTapNeedsRNFallback(enabled, result)).toBe(expected);
    },
  );
});
