const BREADCRUMB_SEPARATOR = " › ";

export function toolbarBreadcrumbLabel(labels: readonly string[]): string {
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .join(BREADCRUMB_SEPARATOR);
}

export function estimatedToolbarBreadcrumbWidth(label: string): number {
  return [...label].reduce((width, character) => {
    if (character.trim().length === 0) {
      return width + 4;
    }
    return width + (character.charCodeAt(0) <= 0x7f ? 7 : 12);
  }, 0);
}
