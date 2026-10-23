import type { ReaderLayoutMode } from "@persimmon/reader-skia";

import type { SystemColumnSide } from "../components/system-column";
import { estimatedToolbarBreadcrumbWidth } from "./toolbar-breadcrumb";

export interface HorizontalInsets {
  readonly left: number;
  readonly right: number;
}

export interface ReaderInsets extends HorizontalInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface ReaderGeometry extends ReaderInsets {
  /** Bottom edge of the camera and status occlusions in the system column. */
  readonly columnOcclusionBottom: number;
}

export interface StableReaderGeometry {
  /** The window size this geometry belongs to, e.g. `951x669`. */
  readonly windowKey: string;
  readonly geometry: ReaderGeometry;
}

/**
 * Keeps reader geometry still while a sheet is open over the reader. A sheet
 * may bring the status bar back, which grows the safe area without changing
 * the window; repaginating under the sheet would move the reader's place.
 * Otherwise, and whenever the window itself changes size (rotation, folding,
 * Split View), the live geometry wins at once.
 */
export function nextStableReaderGeometry(
  previous: StableReaderGeometry | undefined,
  windowKey: string,
  geometry: ReaderGeometry,
  frozen: boolean,
): StableReaderGeometry {
  if (previous && previous.windowKey === windowKey) {
    if (frozen) {
      return previous;
    }
    const current = previous.geometry;
    const unchanged = (Object.keys(geometry) as (keyof ReaderGeometry)[]).every(
      (key) => geometry[key] === current[key],
    );
    if (unchanged) {
      return previous;
    }
  }
  return { windowKey, geometry };
}

export interface ReaderChromeMetrics {
  /** Gap between a control and the screen edge when nothing is reserved. */
  readonly edgeInset: number;
  /** Diameter of a round reader control. */
  readonly control: number;
  /** Gap between neighbouring controls and between a control and text. */
  readonly gap: number;
}

export interface ReaderSystemColumn {
  readonly side: SystemColumnSide;
  readonly width: number;
}

/**
 * The column the system reserves beside the reader (the iPhone Duo outer
 * display keeps one for its camera and status bar), when it is wide enough to
 * hold a control.
 */
export function readerSystemColumn(
  insets: HorizontalInsets,
  control: number,
): ReaderSystemColumn | undefined {
  if (insets.right >= control) {
    return { side: "right", width: insets.right };
  }
  if (insets.left >= control) {
    return { side: "left", width: insets.left };
  }
  return undefined;
}

export interface ReaderChromeInput {
  readonly windowWidth: number;
  readonly insets: HorizontalInsets;
  readonly headerLabel: string;
  /** Top offset of the back button when it sits in the top row. */
  readonly topControlOffset: number;
  /** Bottom edge of the camera and status occlusions in the system column. */
  readonly columnOcclusionBottom: number;
  /**
   * Distance from the column's screen edge to the center line of its camera
   * and status items (see `systemColumnCenterInset`).
   */
  readonly columnCenterInset: number;
  readonly metrics: ReaderChromeMetrics;
}

export interface ReaderChromeLayout {
  /** Back button position, from the left or the right screen edge. */
  readonly back: {
    readonly side: SystemColumnSide;
    readonly offset: number;
    readonly top: number;
  };
  /** Right offset of the table of contents and typography button stack. */
  readonly trailingButtonsRight: number;
  /** Left and right offsets of the toolbar chapter title. */
  readonly header: HorizontalInsets;
}

/**
 * Where a control sits beside one screen edge. In a system column that is at
 * least as wide as the control, the control centers on the column's camera
 * and status items; otherwise it keeps its usual gap outside the inset.
 */
function controlEdgeOffset(
  inset: number,
  columnCenterInset: number,
  { control, edgeInset }: ReaderChromeMetrics,
): number {
  return inset >= control ? columnCenterInset - control / 2 : edgeInset + inset;
}

/**
 * Lays out the reader toolbar. Back sits at the top leading corner, or at the
 * top of a reserved system column right below its camera and status bar, the
 * way system apps place navigation there. The table of contents and
 * typography buttons stack at the bottom trailing corner. A chapter title that
 * fits stays centered on the screen; a longer one keeps clear of the back
 * button and runs as far toward the trailing edge as the safe area allows.
 */
export function readerChromeLayout({
  windowWidth,
  insets,
  headerLabel,
  topControlOffset,
  columnOcclusionBottom,
  columnCenterInset,
  metrics,
}: ReaderChromeInput): ReaderChromeLayout {
  const column = readerSystemColumn(insets, metrics.control);
  const back = column
    ? {
        side: column.side,
        offset: controlEdgeOffset(column.width, columnCenterInset, metrics),
        top: Math.max(topControlOffset, columnOcclusionBottom + metrics.gap),
      }
    : {
        side: "left" as const,
        offset: controlEdgeOffset(insets.left, columnCenterInset, metrics),
        top: topControlOffset,
      };
  const leadingReserve = column
    ? metrics.edgeInset + insets.left
    : back.offset + metrics.control + metrics.gap;
  const trailingReserve = metrics.edgeInset + insets.right;
  const centeredReserve = Math.max(leadingReserve, trailingReserve);
  const fitsCentered =
    estimatedToolbarBreadcrumbWidth(headerLabel) <=
    windowWidth - centeredReserve * 2;
  return {
    back,
    trailingButtonsRight: controlEdgeOffset(
      insets.right,
      columnCenterInset,
      metrics,
    ),
    header: fitsCentered
      ? { left: centeredReserve, right: centeredReserve }
      : { left: leadingReserve, right: trailingReserve },
  };
}

/**
 * Horizontal insets of the paginated reader canvas. A single page fills the
 * safe area. A spread reserves the wider side on both edges so its gutter stays
 * on the screen's center line, which is where a foldable's hinge is.
 */
export function readerPageFrameInsets(
  layout: ReaderLayoutMode,
  insets: HorizontalInsets,
): HorizontalInsets {
  if (layout === "spread") {
    const side = Math.max(insets.left, insets.right);
    return { left: side, right: side };
  }
  return { left: insets.left, right: insets.right };
}
