import {
  pageTurnDirectionModel,
  type PageTurnDirection,
  type PageTurnFace,
} from "./page-turn-direction";

interface PaintablePageTurn {
  readonly completed: boolean;
}

export type { PageTurnFace } from "./page-turn-direction";

export interface PageTurnPaintPass<T extends PaintablePageTurn> {
  readonly turn: T;
  readonly face: PageTurnFace;
}

/**
 * This is one algorithm for both directions. The landing face is painted
 * oldest-to-newest, followed by the source face newest-to-oldest. Backward
 * turns only mirror which physical face represents those two roles.
 */
export function spreadPageTurnPaintPasses<T extends PaintablePageTurn>(
  turns: readonly T[],
  direction: PageTurnDirection,
): PageTurnPaintPass<T>[] {
  const visible = turns.filter((turn) => !turn.completed);
  const model = pageTurnDirectionModel(direction);
  const landingPasses = visible.map((turn) => ({
    turn,
    face: model.landingFace,
  }));
  const sourcePasses = [...visible].reverse().map((turn) => ({
    turn,
    face: model.sourceFace,
  }));
  return [...landingPasses, ...sourcePasses];
}
