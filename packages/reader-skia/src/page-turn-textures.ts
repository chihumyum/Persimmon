import {
  pageTurnDirectionModel,
  pageTurnFaceValues,
  type PageTurnDirection,
} from "./page-turn-direction";
import type { PageAddress } from "./section-navigation";

export interface PageTurnCaptureAddresses<T = PageAddress> {
  readonly front?: T;
  readonly back?: T;
}

/**
 * Resolves the physical front and back of the sheet being turned.
 *
 * A forward turn starts on the right with its front visible and lands on the
 * left with its back visible. A backward turn is the inverse: it starts on the
 * left with its back visible and lands on the right with its front visible.
 */
export function pageTurnCaptureAddresses<T = PageAddress>(
  layout: "single" | "spread",
  direction: PageTurnDirection,
  current: readonly (T | undefined)[],
  target: readonly (T | undefined)[],
): PageTurnCaptureAddresses<T> {
  const model = pageTurnDirectionModel(direction);
  if (layout === "single") {
    const faces = pageTurnFaceValues(direction, current[0], target[0]);
    return { front: faces.front };
  }
  return pageTurnFaceValues(
    direction,
    current[model.sourceSlot],
    target[model.landingSlot],
  );
}
