import { describe, expect, it } from "vitest";

import { normalizeUtf16Boundary } from "./utf16";

describe("normalizeUtf16Boundary", () => {
  it("keeps BookIR offsets in JavaScript UTF-16 coordinates", () => {
    const text = "A柿🍊B";

    expect(text.length).toBe(5);
    expect(normalizeUtf16Boundary(text, 0)).toBe(0);
    expect(normalizeUtf16Boundary(text, 1)).toBe(1);
    expect(normalizeUtf16Boundary(text, 2)).toBe(2);
    expect(normalizeUtf16Boundary(text, 3)).toBe(2);
    expect(normalizeUtf16Boundary(text, 3, "forward")).toBe(4);
    expect(normalizeUtf16Boundary(text, 4)).toBe(4);
    expect(normalizeUtf16Boundary(text, 5)).toBe(5);
  });
});
