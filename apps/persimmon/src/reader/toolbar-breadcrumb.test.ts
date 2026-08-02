import { describe, expect, it } from "vitest";

import {
  estimatedToolbarBreadcrumbWidth,
  toolbarBreadcrumbLabel,
} from "./toolbar-breadcrumb";

describe("toolbar breadcrumb", () => {
  it("keeps every non-empty TOC level from outermost to innermost", () => {
    expect(toolbarBreadcrumbLabel([" 第一部 ", "第五章", " 第三节 "])).toBe(
      "第一部 – 第五章 – 第三节",
    );
  });

  it("drops empty levels without changing the remaining order", () => {
    expect(toolbarBreadcrumbLabel(["第一部", " ", "第三节"])).toBe(
      "第一部 – 第三节",
    );
  });

  it("estimates CJK text wider than ASCII text for carousel overflow", () => {
    expect(estimatedToolbarBreadcrumbWidth("章节")).toBeGreaterThan(
      estimatedToolbarBreadcrumbWidth("ab"),
    );
  });
});
