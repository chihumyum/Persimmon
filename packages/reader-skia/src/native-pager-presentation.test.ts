import { describe, expect, it } from "vitest";

import { NativePagerPresentationGate } from "./native-pager-presentation";

describe("native pager presentation handoff", () => {
  it("waits until the declarative canvas has the consumed target", () => {
    const gate = new NativePagerPresentationGate();
    gate.schedule("turn:forward", "7:0:12");

    expect(gate.turnIdForSettled("7:0:11")).toBeUndefined();
    expect(gate.turnIdForSettled("7:0:12")).toBe("turn:forward");
  });

  it("supersedes a stale handoff during rapid consecutive turns", () => {
    const gate = new NativePagerPresentationGate();
    gate.schedule("turn:first", "7:0:12");
    gate.schedule("turn:second", "7:0:13");

    expect(gate.turnIdForSettled("7:0:12")).toBeUndefined();
    expect(gate.turnIdForSettled("7:0:13")).toBe("turn:second");
  });

  it("uses the turn id to distinguish a reverse visit to the same page", () => {
    const gate = new NativePagerPresentationGate();
    gate.schedule("turn:old-visit", "7:0:12");
    gate.acknowledge("turn:old-visit");
    gate.schedule("turn:reverse-visit", "7:0:12");

    expect(gate.turnIdForSettled("7:0:12")).toBe("turn:reverse-visit");
    gate.acknowledge("turn:old-visit");
    expect(gate.turnIdForSettled("7:0:12")).toBe("turn:reverse-visit");
  });
});
