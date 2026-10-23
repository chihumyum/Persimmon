import { describe, expect, it } from "vitest";

import { systemColumnCenterInset } from "./system-column";

describe("system column center inset", () => {
  it("centers on the camera of the outer display", () => {
    expect(
      systemColumnCenterInset(
        [
          { x: 400, y: 29, width: 37, height: 37 },
          { x: 382, y: 0, width: 84, height: 174 },
        ],
        466,
        "right",
        84,
      ),
    ).toBe(47.5);
  });

  it("falls back to the measured status line without a camera", () => {
    expect(
      systemColumnCenterInset(
        [{ x: 867, y: 0, width: 84, height: 124 }],
        951,
        "right",
        84,
      ),
    ).toBe(48);
  });
});
