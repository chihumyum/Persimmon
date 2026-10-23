import {
  systemColumnCenterInset,
  systemColumnOcclusionBottom,
  type LayoutRect,
} from "../components/system-column";

export interface LibraryChromeInput {
  readonly windowWidth: number;
  readonly compactBreakpoint: number;
  readonly insets: {
    readonly top: number;
    readonly left: number;
    readonly right: number;
  };
  /** The system's vertical bar edge when the native layout probe knows it. */
  readonly verticalBarEdge?: "leading" | "trailing";
  /** Active system occlusions in window points. */
  readonly occlusions: readonly LayoutRect[];
  readonly control: number;
  readonly gap: number;
  readonly topControlOffset: number;
}

export type LibraryChrome =
  | { readonly kind: "toolbar" }
  | {
      readonly kind: "column";
      readonly side: "left" | "right";
      readonly width: number;
      /**
       * Distance from the column's screen edge to the center line of its
       * camera and status items, where the controls center.
       */
      readonly centerInset: number;
      /** Top offset of the first control below the system status column. */
      readonly top: number;
    };

/** Narrower side insets are display corners, not a system column. */
const MINIMUM_COLUMN_INSET = 44;

/**
 * Chooses where the library actions live. A window with a vertical system bar
 * (both iPhone Duo displays) moves them into the column the system reserves
 * beside the content; every other window keeps the toolbar.
 */
export function libraryChrome({
  windowWidth,
  compactBreakpoint,
  insets,
  verticalBarEdge,
  occlusions,
  control,
  gap,
  topControlOffset,
}: LibraryChromeInput): LibraryChrome {
  const side = insets.left > insets.right ? "left" : "right";
  const width = side === "left" ? insets.left : insets.right;
  // The native probe knows the vertical bar on both iPhone Duo displays.
  // Without it, only a compact window's wide side inset is read as one.
  const hasVerticalBar =
    verticalBarEdge !== undefined ||
    (width >= MINIMUM_COLUMN_INSET &&
      width > insets.top &&
      windowWidth < compactBreakpoint);
  if (!hasVerticalBar || width < control) {
    return { kind: "toolbar" };
  }
  const occludedBottom = systemColumnOcclusionBottom(
    occlusions,
    windowWidth,
    side,
    width,
  );
  return {
    kind: "column",
    side,
    width,
    centerInset: systemColumnCenterInset(occlusions, windowWidth, side, width),
    top: Math.max(topControlOffset, occludedBottom + gap),
  };
}

export interface ScrollChromeState {
  readonly visible: boolean;
  /** Offset where the current scroll direction began. */
  readonly anchor: number;
}

/**
 * Hides floating toolbar actions after the content has moved up by
 * `distance` and brings them back as soon as it moves down by the same
 * amount. Near the top they always show, resting beside the large title.
 */
export function nextScrollChromeState(
  state: ScrollChromeState,
  offset: number,
  revealOffset: number,
  distance: number,
): ScrollChromeState {
  if (offset <= revealOffset) {
    return { visible: true, anchor: offset };
  }
  if (state.visible) {
    if (offset < state.anchor) {
      return { visible: true, anchor: offset };
    }
    return offset - state.anchor >= distance
      ? { visible: false, anchor: offset }
      : state;
  }
  if (offset > state.anchor) {
    return { visible: false, anchor: offset };
  }
  return state.anchor - offset >= distance
    ? { visible: true, anchor: offset }
    : state;
}

/**
 * How far from the trailing screen edge a row of controls has to stay to
 * clear a system occlusion in that corner, such as the stacked status bar the
 * iPhone Duo inner display keeps in its top-right corner in portrait. The
 * Dynamic Island of other iPhones sits centered above the row and is ignored.
 */
export function trailingOcclusionReserve(
  occlusions: readonly LayoutRect[],
  windowWidth: number,
  rowTop: number,
  rowHeight: number,
): number {
  return occlusions
    .filter(
      (rect) =>
        rect.x + rect.width >= windowWidth - 1 &&
        rect.y < rowTop + rowHeight &&
        rect.y + rect.height > rowTop,
    )
    .reduce((reserve, rect) => Math.max(reserve, windowWidth - rect.x), 0);
}

/**
 * How far below the center of a corner status block its clock and Wi-Fi
 * glyphs sit. The system reports the reserved block, not where it draws the
 * status items inside it. Measured on the iPhone Duo inner display in
 * portrait (iOS 27.1 simulator): the block spans 0–82pt while the clock and
 * the Wi-Fi glyph are both centered at 47.8pt. The ring drawn around the
 * Wi-Fi glyph is open at the bottom, so its own center sits higher and is
 * not what the eye lines up with.
 */
export const CORNER_STATUS_CONTENT_OFFSET = 6.8;

/**
 * Top offset for a toolbar row that shares its line with a status bar
 * stacked in the trailing corner, such as the iPhone Duo inner display in
 * portrait. That block is what produces the top safe area, but the row only
 * has to keep clear of it sideways (see `trailingOcclusionReserve`), so the
 * row centers on the status items the way the title of a system app lines up
 * with the clock. Returns undefined when the top inset comes from a status
 * bar that spans the screen, so callers keep their usual offset.
 */
export function cornerStatusRowTop(
  topInset: number,
  occlusions: readonly LayoutRect[],
  windowWidth: number,
  rowHeight: number,
  minimumTop: number,
): number | undefined {
  if (topInset <= 0) {
    return undefined;
  }
  const block = occlusions.find(
    (rect) =>
      rect.x > windowWidth / 2 &&
      rect.x + rect.width >= windowWidth - 1 &&
      rect.y <= 1 &&
      rect.y + rect.height >= topInset - 1,
  );
  if (!block) {
    return undefined;
  }
  const statusCenter =
    block.y + block.height / 2 + CORNER_STATUS_CONTENT_OFFSET;
  return Math.max(minimumTop, statusCenter - rowHeight / 2);
}
