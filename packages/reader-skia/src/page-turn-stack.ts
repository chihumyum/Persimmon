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
 * oldest-to-newest, including a later sheet that has already landed while an
 * older prefix is still moving. The source face remains newest-to-oldest and
 * excludes landed sheets. Backward turns only mirror which physical face
 * represents those two roles.
 */
export function spreadPageTurnPaintPasses<T extends PaintablePageTurn>(
  turns: readonly T[],
  direction: PageTurnDirection,
): PageTurnPaintPass<T>[] {
  const moving = turns.filter((turn) => !turn.completed);
  const model = pageTurnDirectionModel(direction);
  const landingPasses = turns.map((turn) => ({
    turn,
    face: model.landingFace,
  }));
  const sourcePasses = [...moving].reverse().map((turn) => ({
    turn,
    face: model.sourceFace,
  }));
  return [...landingPasses, ...sourcePasses];
}
