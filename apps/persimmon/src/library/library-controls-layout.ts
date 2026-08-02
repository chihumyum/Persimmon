export interface LibraryControlsMeasurement {
  readonly controlsWidth: number;
  readonly filterContentWidth: number;
  readonly expandedSortWidth: number;
  readonly gap: number;
}

export function shouldUseIconOnlySort({
  controlsWidth,
  filterContentWidth,
  expandedSortWidth,
  gap,
}: LibraryControlsMeasurement): boolean {
  if (controlsWidth <= 0 || filterContentWidth <= 0 || expandedSortWidth <= 0) {
    return false;
  }
  return filterContentWidth + expandedSortWidth + gap > controlsWidth;
}
