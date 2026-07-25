import {
  pageTurnDirectionModel,
  type PageTurnDirection,
} from "./page-turn-direction";
import type { PageAddress } from "./section-navigation";

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
