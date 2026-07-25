interface PaintablePageTurn {
  readonly completed: boolean;
}

export type PageTurnFace = "back" | "front";

export interface PageTurnPaintPass<T extends PaintablePageTurn> {
  readonly turn: T;
  readonly face: PageTurnFace;
}

/**
 * A later sheet is physically sandwiched between the two faces of every sheet
 * that started before it. Skia paints later siblings on top, so backs are
 * painted oldest-to-newest and fronts newest-to-oldest:
 *
 * old back < new back/front < old front
 */
export function spreadPageTurnPaintPasses<T extends PaintablePageTurn>(
  turns: readonly T[],
): PageTurnPaintPass<T>[] {
  const visible = turns.filter((turn) => !turn.completed);
  return [
    ...visible.map((turn) => ({ turn, face: "back" as const })),
    ...[...visible].reverse().map((turn) => ({ turn, face: "front" as const })),
  ];
}
