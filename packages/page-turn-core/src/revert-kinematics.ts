const MIN_REVERT_INITIAL_SPEED = 0.65;
const MAX_REVERT_INITIAL_SPEED = 6.3;
const EASE_OUT_INITIAL_SLOPE = 3;

export function revertInitialSpeed(rollCompleteness: number): number {
  const completeness = clamp(rollCompleteness, 0, 1);
  return (
    MIN_REVERT_INITIAL_SPEED +
    (MAX_REVERT_INITIAL_SPEED - MIN_REVERT_INITIAL_SPEED) * completeness
  );
}

export function revertDuration(
  startEdgeX: number,
  rollCompleteness: number,
): number {
  const distance = Math.max(0, 1 - clamp(startEdgeX, 0, 1));
  if (distance <= 1e-8) {
    return 0;
  }
  return (
    (EASE_OUT_INITIAL_SLOPE * distance) / revertInitialSpeed(rollCompleteness)
  );
}

export function revertPressedEdgeX(
  startEdgeX: number,
  elapsed: number,
  rollCompleteness: number,
): number {
  const start = clamp(startEdgeX, 0, 1);
  const duration = revertDuration(start, rollCompleteness);
  if (duration <= 1e-8) {
    return 1;
  }
  const progress = clamp(elapsed / duration, 0, 1);
  const easedProgress = 1 - (1 - progress) ** 3;
  return start + (1 - start) * easedProgress;
}

export function revertEasedProgress(elapsed: number, duration: number): number {
  if (duration <= 1e-8) {
    return 1;
  }
  const progress = clamp(elapsed / duration, 0, 1);
  return 1 - (1 - progress) ** 3;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
