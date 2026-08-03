import { describe, expect, it } from "vitest";

import {
  NativePagerFirstFrameGate,
  NativePagerPresentationGate,
} from "./native-pager-presentation";

describe("native pager first-frame barrier", () => {
  it("does not release a consumed turn before its presented start", () => {
    const gate = new NativePagerFirstFrameGate();
    gate.reserve("turn:cold");

    expect(gate.confirmPresented("turn:other")).toBe(false);
    expect(gate.confirmPresented("turn:cold")).toBe(true);
    expect(gate.confirmPresented("turn:cold")).toBe(false);
  });

  it("forgets an unpresented turn when native cancels or resets", () => {
    const gate = new NativePagerFirstFrameGate();
    gate.reserve("turn:cancelled");
    gate.discard("turn:cancelled");
    expect(gate.confirmPresented("turn:cancelled")).toBe(false);

    gate.reserve("turn:reset");
    gate.reset();
    expect(gate.confirmPresented("turn:reset")).toBe(false);
  });
});

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
