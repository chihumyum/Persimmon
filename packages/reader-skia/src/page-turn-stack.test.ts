import { describe, expect, it } from "vitest";

import { visiblePageTurnsInPaintOrder } from "./page-turn-stack";

describe("page-turn paint order", () => {
  it("paints a later concurrent sheet over an earlier sheet", () => {
    const turns = [
      { id: "older-left-sheet", completed: false },
      { id: "landed-prefix", completed: true },
      { id: "newer-turning-sheet", completed: false },
    ];

    const ordered = visiblePageTurnsInPaintOrder(turns);

    expect(ordered.map((turn) => turn.id)).toEqual([
      "older-left-sheet",
      "newer-turning-sheet",
    ]);
    expect(ordered.at(-1)?.id).toBe("newer-turning-sheet");
  });
});
