import { describe, expect, it, vi } from "vitest";

import {
  bindNativePagerInput,
  nativePagerTapNeedsRNFallback,
  resolveNativePagerGestureInputPolicy,
} from "./native-pager-input";

describe("native pager gesture input policy", () => {
  it("keeps a warm gesture enabled while direct tap sheets are draining", () => {
    expect(
      resolveNativePagerGestureInputPolicy({
        selectionActive: false,
        benchmarkActive: false,
        nativePagerInputReady: true,
        directTapActive: true,
      }),
    ).toEqual({
      recognizerEnabled: true,
      nativeGestureInputEnabled: true,
    });
  });

  it("keeps the recognizer available for a cold native fallback", () => {
    expect(
      resolveNativePagerGestureInputPolicy({
        selectionActive: false,
        benchmarkActive: false,
        nativePagerInputReady: false,
        directTapActive: false,
      }),
    ).toEqual({
      recognizerEnabled: true,
      nativeGestureInputEnabled: false,
    });
  });

  it.each([
    { selectionActive: true, benchmarkActive: false },
    { selectionActive: false, benchmarkActive: true },
  ])(
    "disables gesture input for selection=$selectionActive benchmark=$benchmarkActive",
    ({ selectionActive, benchmarkActive }) => {
      expect(
        resolveNativePagerGestureInputPolicy({
          selectionActive,
          benchmarkActive,
          nativePagerInputReady: true,
          directTapActive: true,
        }),
      ).toEqual({
        recognizerEnabled: false,
        nativeGestureInputEnabled: false,
      });
    },
  );
});

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
