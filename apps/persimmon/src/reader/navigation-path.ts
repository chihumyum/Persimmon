import type {
  BookIR,
  BookNavigationItem,
  BookPosition,
} from "@persimmon/book-core";

interface OrderedPosition {
  readonly sectionIndex: number;
  readonly blockIndex: number;
  readonly offset: number;
}

interface NavigationCandidate {
  readonly path: readonly BookNavigationItem[];
  readonly position: OrderedPosition;
}

export function navigationLabelsForPosition(
  book: BookIR,
  position: BookPosition | undefined,
): readonly string[] {
  if (!position || !book.navigation?.length) {
    return [];
  }
  const currentPosition = orderedPosition(book, position);
  if (!currentPosition) {
    return [];
  }

  let active: NavigationCandidate | undefined;
  const visit = (
    items: readonly BookNavigationItem[],
    ancestors: readonly BookNavigationItem[],
  ) => {
    for (const item of items) {
      const path = [...ancestors, item];
      const target = orderedPosition(book, item.target);
      if (
        target &&
        compareOrderedPositions(target, currentPosition) <= 0 &&
        (!active || compareOrderedPositions(target, active.position) >= 0)
      ) {
        active = { path, position: target };
      }
      visit(item.children ?? [], path);
    }
  };
  visit(book.navigation, []);

  return active
    ? active.path.map((item) => item.label.trim()).filter(Boolean)
    : [];
}

function orderedPosition(
  book: BookIR,
  position: BookPosition,
): OrderedPosition | undefined {
  const sectionIndex = book.sections.findIndex(
    (section) => section.id === position.sectionId,
  );
  if (sectionIndex < 0) {
    return undefined;
  }
  const blockIndex = book.sections[sectionIndex]!.blocks.findIndex(
    (block) => block.id === position.blockId,
  );
  if (blockIndex < 0) {
    return undefined;
  }
  return {
    sectionIndex,
    blockIndex,
    offset: Math.max(0, Math.floor(position.offset)),
  };
}

function compareOrderedPositions(
  left: OrderedPosition,
  right: OrderedPosition,
): number {
  return (
    left.sectionIndex - right.sectionIndex ||
    left.blockIndex - right.blockIndex ||
    left.offset - right.offset
  );
}
