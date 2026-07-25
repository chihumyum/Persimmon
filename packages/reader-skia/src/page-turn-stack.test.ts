import { describe, expect, it } from "vitest";

import { spreadPageTurnPaintPasses } from "./page-turn-stack";

describe("page-turn paint order", () => {
  const turns = [
    { id: "older-sheet", completed: false },
    { id: "landed-prefix", completed: true },
    { id: "newer-sheet", completed: false },
  ];

  it("keeps newer fronts below older fronts during a forward turn", () => {
    const passes = spreadPageTurnPaintPasses(turns, 1);

    expect(passes.map(({ turn, face }) => `${turn.id}:${face}`)).toEqual([
      "older-sheet:back",
      "newer-sheet:back",
      "newer-sheet:front",
      "older-sheet:front",
    ]);
  });

  it("mirrors the forward face roles for a backward turn", () => {
    const passes = spreadPageTurnPaintPasses(turns, -1);

    expect(passes.map(({ turn, face }) => `${turn.id}:${face}`)).toEqual([
      "older-sheet:front",
      "newer-sheet:front",
      "newer-sheet:back",
      "older-sheet:back",
    ]);
  });
});
