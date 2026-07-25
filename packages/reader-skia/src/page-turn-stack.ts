interface PaintablePageTurn {
  readonly completed: boolean;
}

/**
 * Skia paints later siblings over earlier siblings. Scheduler order is also
 * physical sheet order, so preserving it makes the newest turn the top sheet.
 * This is independent of turn direction: reversing forward turns would put an
 * older left-page sheet over the page that was started after it.
 */
export function visiblePageTurnsInPaintOrder<T extends PaintablePageTurn>(
  turns: readonly T[],
): T[] {
  return turns.filter((turn) => !turn.completed);
}
