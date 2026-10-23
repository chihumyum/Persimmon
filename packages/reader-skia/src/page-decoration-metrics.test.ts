import { describe, expect, it } from "vitest";

import {
  PAGE_DECORATION_LINE_HEIGHT,
  pageDecorationFooterY,
  pageDecorationHeaderY,
} from "./page-decoration-metrics";
import { readerPageVerticalPadding } from "./reader-layout-spec";

function center(top: number): number {
  return top + PAGE_DECORATION_LINE_HEIGHT / 2;
}

describe("page decoration placement", () => {
  it("centers the chapter title between a bare top edge and the text", () => {
    const { top } = readerPageVerticalPadding(0, 34);

    expect(center(pageDecorationHeaderY(0, 34))).toBeCloseTo(top / 2);
  });

  it("keeps the chapter title below the Dynamic Island", () => {
    const { top } = readerPageVerticalPadding(62, 34);
    const headerY = pageDecorationHeaderY(62, 34);

    expect(headerY).toBeGreaterThan(62);
    expect(center(headerY)).toBeCloseTo((62 + top) / 2);
  });

  it("centers the page number between the text and the bottom edge", () => {
    const { bottom } = readerPageVerticalPadding(0, 34);

    expect(center(pageDecorationFooterY(669, 0, 34))).toBeCloseTo(
      669 - bottom / 2,
    );
  });
});
