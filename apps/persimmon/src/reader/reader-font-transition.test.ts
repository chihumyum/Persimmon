import { describe, expect, it } from "vitest";

import {
  resolveReaderFontTransition,
  type PreparedReaderFont,
} from "./reader-font-transition";

function preparedFont(
  name: string,
  error?: string,
): PreparedReaderFont<{ readonly name: string }> {
  return {
    fontProvider: { name },
    fontFamily: name,
    providerKey: `provider:${name}`,
    ...(error ? { error } : {}),
  };
}

describe("reader font transitions", () => {
  it("keeps the current provider mounted while a newly selected font loads", () => {
    const previous = preparedFont("previous");
    const transition = resolveReaderFontTransition({
      previous,
      fallback: preparedFont("fallback"),
      loading: true,
    });

    expect(transition).toEqual({
      active: previous,
      loading: true,
    });
  });

  it("uses a built-in provider without reporting a false failure on cold load", () => {
    const fallback = preparedFont("fallback");
    const transition = resolveReaderFontTransition({
      fallback,
      loading: true,
    });

    expect(transition).toEqual({
      active: fallback,
      loading: true,
    });
  });

  it("commits a prepared fallback and reports a real font failure", () => {
    const failed = preparedFont("fallback", "字体文件读取失败。");
    const transition = resolveReaderFontTransition({
      prepared: failed,
      previous: preparedFont("previous"),
      fallback: preparedFont("fallback"),
      loading: false,
    });

    expect(transition).toEqual({
      active: failed,
      loading: false,
      error: "字体文件读取失败。",
    });
  });
});
