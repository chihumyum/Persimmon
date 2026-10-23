import { describe, expect, it } from "vitest";

import { effectiveReaderLayout } from "./reader-layout-mode";

const none = { left: 0, right: 0 };

describe("effective reader layout", () => {
  it.each([
    ["iPhone portrait", 402, 874, none, "single"],
    ["iPhone Duo outer display", 466, 678, { left: 0, right: 84 }, "single"],
    ["iPhone Duo inner display, landscape", 951, 669, none, "spread"],
    ["iPhone Duo inner display, portrait", 669, 951, none, "single"],
    ["iPhone Duo inner display, half Split View", 475, 669, none, "single"],
    ["iPad landscape", 1180, 820, none, "spread"],
    ["iPad portrait", 820, 1180, none, "single"],
    ["iPhone landscape", 874, 402, { left: 62, right: 62 }, "single"],
  ] as const)(
    "auto picks the right layout on %s",
    (_, width, height, insets, expected) => {
      expect(effectiveReaderLayout("auto", { width, height, insets })).toBe(
        expected,
      );
    },
  );

  it("keeps a single page whatever the window", () => {
    expect(
      effectiveReaderLayout("single", {
        width: 1180,
        height: 820,
        insets: none,
      }),
    ).toBe("single");
  });

  it("keeps a chosen spread in any window", () => {
    expect(
      effectiveReaderLayout("spread", {
        width: 874,
        height: 402,
        insets: { left: 62, right: 62 },
      }),
    ).toBe("spread");
    expect(
      effectiveReaderLayout("spread", {
        width: 466,
        height: 678,
        insets: { left: 0, right: 84 },
      }),
    ).toBe("spread");
    expect(
      effectiveReaderLayout("spread", {
        width: 669,
        height: 951,
        insets: none,
      }),
    ).toBe("spread");
  });

  it("measures the spread after mirroring the wider side inset", () => {
    const statusColumn = { left: 0, right: 84 };

    expect(
      effectiveReaderLayout("auto", {
        width: 1000,
        height: 669,
        insets: statusColumn,
      }),
    ).toBe("spread");
    expect(
      effectiveReaderLayout("auto", {
        width: 951,
        height: 669,
        insets: statusColumn,
      }),
    ).toBe("single");
  });
});
