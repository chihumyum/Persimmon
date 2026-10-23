import { describe, expect, it } from "vitest";

import {
  cornerStatusRowTop,
  libraryChrome,
  nextScrollChromeState,
  trailingOcclusionReserve,
  type LibraryChromeInput,
} from "./library-chrome-layout";

const phone: LibraryChromeInput = {
  windowWidth: 402,
  compactBreakpoint: 720,
  insets: { top: 62, left: 0, right: 0 },
  occlusions: [],
  control: 50,
  gap: 8,
  topControlOffset: 50,
};

const duoOuter: LibraryChromeInput = {
  ...phone,
  windowWidth: 466,
  insets: { top: 0, left: 0, right: 84 },
  verticalBarEdge: "trailing",
  occlusions: [
    { x: 400, y: 29, width: 37, height: 37 },
    { x: 382, y: 0, width: 84, height: 174 },
  ],
};

describe("library chrome", () => {
  it("keeps the toolbar on a phone without a vertical bar", () => {
    expect(libraryChrome(phone)).toEqual({ kind: "toolbar" });
  });

  it("moves the actions into the outer display's system column", () => {
    expect(libraryChrome(duoOuter)).toEqual({
      kind: "column",
      side: "right",
      width: 84,
      centerInset: 47.5,
      top: 182,
    });
  });

  it("uses the same column on the inner display", () => {
    expect(
      libraryChrome({
        ...duoOuter,
        windowWidth: 951,
        occlusions: [{ x: 867, y: 0, width: 84, height: 124 }],
      }),
    ).toEqual({
      kind: "column",
      side: "right",
      width: 84,
      centerInset: 48,
      top: 132,
    });
  });

  it("only guesses a column from insets on a compact window", () => {
    expect(
      libraryChrome({
        ...duoOuter,
        windowWidth: 951,
        verticalBarEdge: undefined,
        occlusions: [],
      }),
    ).toEqual({ kind: "toolbar" });
  });

  it("falls back to the side inset when the native probe is missing", () => {
    expect(
      libraryChrome({
        ...duoOuter,
        verticalBarEdge: undefined,
        occlusions: [],
      }),
    ).toEqual({
      kind: "column",
      side: "right",
      width: 84,
      centerInset: 48,
      top: 50,
    });
  });

  it("ignores occlusions outside the column", () => {
    expect(
      libraryChrome({
        ...duoOuter,
        occlusions: [{ x: 0, y: 0, width: 40, height: 300 }],
      }),
    ).toMatchObject({ top: 50 });
  });
});

describe("scroll chrome state", () => {
  const reveal = 20;
  const distance = 24;

  it("always shows the actions near the top", () => {
    expect(
      nextScrollChromeState(
        { visible: false, anchor: 300 },
        10,
        reveal,
        distance,
      ),
    ).toEqual({ visible: true, anchor: 10 });
  });

  it("hides after the content moves up by the distance", () => {
    const start = { visible: true, anchor: 100 };

    expect(nextScrollChromeState(start, 110, reveal, distance)).toBe(start);
    expect(nextScrollChromeState(start, 124, reveal, distance)).toEqual({
      visible: false,
      anchor: 124,
    });
  });

  it("shows again once the content moves back down by the distance", () => {
    let state = { visible: false, anchor: 400 };
    state = nextScrollChromeState(state, 420, reveal, distance);
    expect(state).toEqual({ visible: false, anchor: 420 });
    state = nextScrollChromeState(state, 405, reveal, distance);
    expect(state.visible).toBe(false);
    state = nextScrollChromeState(state, 396, reveal, distance);
    expect(state).toEqual({ visible: true, anchor: 396 });
  });
});

describe("trailing occlusion reserve", () => {
  it("clears the inner display's stacked status bar in portrait", () => {
    expect(
      trailingOcclusionReserve(
        [{ x: 525, y: 0, width: 144, height: 82 }],
        669,
        50,
        50,
      ),
    ).toBe(144);
  });

  it("ignores a centered Dynamic Island above the row", () => {
    expect(
      trailingOcclusionReserve(
        [{ x: 140, y: 11, width: 122, height: 37 }],
        402,
        50,
        50,
      ),
    ).toBe(0);
  });

  it("ignores a corner occlusion that ends above the row", () => {
    expect(
      trailingOcclusionReserve(
        [{ x: 525, y: 0, width: 144, height: 40 }],
        669,
        50,
        50,
      ),
    ).toBe(0);
  });
});

describe("corner status row top", () => {
  const innerPortraitStatus = { x: 525, y: 0, width: 144, height: 82 };

  it("centers the toolbar row on the inner display's clock and Wi-Fi", () => {
    expect(
      cornerStatusRowTop(82, [innerPortraitStatus], 669, 50, 8),
    ).toBeCloseTo(22.8);
  });

  it("keeps the usual offset when the status bar spans the top", () => {
    expect(
      cornerStatusRowTop(
        62,
        [{ x: 140, y: 11, width: 122, height: 37 }],
        402,
        50,
        8,
      ),
    ).toBeUndefined();
  });

  it("ignores a corner block that does not explain the whole inset", () => {
    expect(
      cornerStatusRowTop(
        82,
        [{ ...innerPortraitStatus, height: 40 }],
        669,
        50,
        8,
      ),
    ).toBeUndefined();
    expect(cornerStatusRowTop(0, [innerPortraitStatus], 669, 50, 8)).toBe(
      undefined,
    );
  });
});
