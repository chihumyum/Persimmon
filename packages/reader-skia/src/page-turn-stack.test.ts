import { describe, expect, it } from "vitest";

import { spreadPageTurnPaintPasses } from "./page-turn-stack";

describe("page-turn paint order", () => {
  it("sandwiches a newer sheet between the older sheet's back and front", () => {
    const turns = [
      { id: "older-left-sheet", completed: false },
      { id: "landed-prefix", completed: true },
      { id: "newer-turning-sheet", completed: false },
    ];

    const passes = spreadPageTurnPaintPasses(turns);

    expect(passes.map(({ turn, face }) => `${turn.id}:${face}`)).toEqual([
      "older-left-sheet:back",
      "newer-turning-sheet:back",
      "newer-turning-sheet:front",
      "older-left-sheet:front",
    ]);
  });
});
