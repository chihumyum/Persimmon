import { describe, expect, it } from "vitest";

import {
  androidUiNodeCenter,
  findAndroidUiNode,
  parseAndroidScreenSize,
  parseAndroidUiNodes,
  readerPageNumber,
} from "./android-ui-hierarchy";

const HIERARCHY = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node text="" content-desc="双栏，每屏并排显示两页" checked="true" enabled="true" bounds="[840,1800][1500,2120]" />
  <node text="3447" content-desc="全书第 3447 页" checked="false" enabled="true" bounds="[800,2400][880,2450]" />
</hierarchy>`;

describe("Android UI hierarchy parsing", () => {
  it("finds labelled controls and their tap coordinates", () => {
    const nodes = parseAndroidUiNodes(HIERARCHY);
    const spread = findAndroidUiNode(nodes, "双栏，每屏并排显示两页");

    expect(spread?.checked).toBe(true);
    expect(spread && androidUiNodeCenter(spread)).toEqual({ x: 1170, y: 1960 });
  });

  it("reads the current publication page", () => {
    expect(readerPageNumber(parseAndroidUiNodes(HIERARCHY))).toBe(3447);
  });

  it("prefers an active size override", () => {
    expect(
      parseAndroidScreenSize(
        "Physical size: 1680x2520\nOverride size: 1080x1620\n",
      ),
    ).toEqual({ width: 1080, height: 1620 });
  });
});
