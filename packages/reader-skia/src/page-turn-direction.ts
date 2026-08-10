export type PageTurnDirection = 1 | -1;
export type PageTurnFace = "front" | "back";
export type PageTurnSlot = 0 | 1;

export interface PageTurnDirectionModel {
  readonly sourceSlot: PageTurnSlot;
  readonly landingSlot: PageTurnSlot;
  readonly sourceFace: PageTurnFace;
  readonly landingFace: PageTurnFace;
}

const FORWARD_PAGE_TURN: PageTurnDirectionModel = {
  sourceSlot: 1,
  landingSlot: 0,
  sourceFace: "front",
  landingFace: "back",
};

function mirrorPageTurnDirection(
  model: PageTurnDirectionModel,
): PageTurnDirectionModel {
  return {
    sourceSlot: model.landingSlot,
    landingSlot: model.sourceSlot,
    sourceFace: model.landingFace,
    landingFace: model.sourceFace,
  };
}

const BACKWARD_PAGE_TURN = mirrorPageTurnDirection(FORWARD_PAGE_TURN);

export function pageTurnDirectionModel(
  direction: PageTurnDirection,
): PageTurnDirectionModel {
  return direction === 1 ? FORWARD_PAGE_TURN : BACKWARD_PAGE_TURN;
}

export function pageTurnXScale(
  direction: PageTurnDirection,
): PageTurnDirection {
  "worklet";
  return direction;
}

export function pageTurnTuningForDirection<Forward, Backward>(
  forward: Forward,
  backward: Backward,
  direction: PageTurnDirection,
): Forward | Backward {
  return direction === 1 ? forward : backward;
}

/**
 * A spread turns the same outgoing sheet in either direction. Reuse the
 * forward physics and let the direction model provide the mirror. The
 * incoming-page tuning remains exclusive to a single-column backward turn.
 * This applies to automatic, rapid, and gesture turns.
 */
export function pageTurnTuningForLayoutDirection<Forward, Backward>(
  forward: Forward,
  backward: Backward,
  direction: PageTurnDirection,
  spread: boolean,
): Forward | Backward {
  return spread
    ? forward
    : pageTurnTuningForDirection(forward, backward, direction);
}

export function pageTurnSolverDirectionForLayout(
  direction: PageTurnDirection,
  spread: boolean,
): PageTurnDirection {
  return spread ? 1 : direction;
}

export function pageTurnFaceValues<T>(
  direction: PageTurnDirection,
  source: T,
  landing: T,
): Readonly<Record<PageTurnFace, T>> {
  const model = pageTurnDirectionModel(direction);
  return model.sourceFace === "front"
    ? { front: source, back: landing }
    : { front: landing, back: source };
}

export function shouldDrawPageTurnShadow(
  direction: PageTurnDirection,
  face: PageTurnFace | "both",
): boolean {
  return (
    face === "both" || face === pageTurnDirectionModel(direction).sourceFace
  );
}

export function isPageTurnSourceFacing(
  direction: PageTurnDirection,
  frontFacing: boolean,
): boolean {
  "worklet";
  return (frontFacing ? 1 : -1) === direction;
}
