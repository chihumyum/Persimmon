import {
  pageTurnDirectionModel,
  type PageTurnDirection,
} from "./page-turn-direction";
import type { PageAddress } from "./section-navigation";

interface PaintReadyPageTurn {
  readonly completed: boolean;
  readonly handoffPending: boolean;
  readonly interactive: boolean;
  readonly laneReady: boolean;
}

/**
 * Native capture readiness and native animation readiness are separate.
 * Textures can reach React one commit before the UI-thread lane installs its
 * first shared frame. Keep a strict source-order prefix so the live page stays
 * in front until every visible native sheet can actually paint.
 */
export function pageTurnsReadyForPaint<T extends PaintReadyPageTurn>(
  turns: readonly T[],
  native: boolean,
): T[] {
  if (!native) {
    return [...turns];
  }
  const ready: T[] = [];
  for (const turn of turns) {
    if (
      !turn.completed &&
      !turn.interactive &&
      !turn.handoffPending &&
      !turn.laneReady
    ) {
      break;
    }
    ready.push(turn);
  }
  return ready;
}

/**
 * Keeps the oldest active sheet's current spread on the landing side while
 * the source side reveals the newest requested spread.
 */
export function pageTurnBackgroundSlots(
  layout: "single" | "spread",
  direction: PageTurnDirection,
  oldestFrom: readonly (PageAddress | undefined)[],
  newestTarget: readonly (PageAddress | undefined)[],
): readonly (PageAddress | undefined)[] {
  const model = pageTurnDirectionModel(direction);
  if (layout === "single") {
    return [model.sourceFace === "front" ? newestTarget[0] : oldestFrom[0]];
  }
  const slots = [oldestFrom[0], oldestFrom[1]];
  slots[model.sourceSlot] = newestTarget[model.sourceSlot];
  return slots;
}
