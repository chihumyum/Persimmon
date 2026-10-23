import { describe, expect, it } from "vitest";

import { clampSheetSnapPoints } from "./sheet-snap-points";

describe("sheet snap point clamp", () => {
  it("keeps snap points that already stop below the limit", () => {
    expect(clampSheetSnapPoints(["40%", "58%"], 678, 496)).toEqual([
      "40.0%",
      "58.0%",
    ]);
  });

  it("caps tall sheets below the outer display's status column", () => {
    expect(clampSheetSnapPoints(["92%"], 678, 496)).toEqual(["73.2%"]);
  });

  it("converts point heights into window fractions", () => {
    expect(clampSheetSnapPoints([339], 678, 678)).toEqual(["50.0%"]);
  });

  it("keeps clamped detents distinct", () => {
    expect(clampSheetSnapPoints(["40%", "58%", "76%"], 678, 339)).toEqual([
      "40.0%",
      "50.0%",
      "49.9%",
    ]);
  });
});
