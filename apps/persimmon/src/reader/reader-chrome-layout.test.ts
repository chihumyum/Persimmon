import { describe, expect, it } from "vitest";

import {
  nextStableReaderGeometry,
  readerChromeLayout,
  readerPageFrameInsets,
  readerSystemColumn,
} from "./reader-chrome-layout";

const metrics = { control: 50, edgeInset: 12, gap: 8 };
const noInsets = { left: 0, right: 0 };

describe("reader chrome layout", () => {
  const phone = {
    windowWidth: 402,
    insets: noInsets,
    headerLabel: "第一章",
    topControlOffset: 50,
    columnOcclusionBottom: 0,
    columnCenterInset: 0,
    metrics,
  };
  const duoOuter = {
    ...phone,
    windowWidth: 466,
    insets: { left: 0, right: 84 },
    topControlOffset: 24,
    columnOcclusionBottom: 82,
    columnCenterInset: 47.5,
  };
  const longTitle = "第一部 – 第五章 – 一个很长很长很长很长很长很长的小节标题";

  it("keeps back in the top leading corner without a system column", () => {
    expect(readerChromeLayout(phone)).toMatchObject({
      back: { side: "left", offset: 12, top: 50 },
      trailingButtonsRight: 12,
    });
  });

  it("moves back into the system column below the camera", () => {
    expect(readerChromeLayout(duoOuter)).toMatchObject({
      back: { side: "right", offset: 22.5, top: 90 },
      trailingButtonsRight: 22.5,
    });
  });

  it("centers a chapter title that fits between symmetric reserves", () => {
    expect(readerChromeLayout(phone).header).toEqual({ left: 70, right: 70 });
    expect(readerChromeLayout(duoOuter).header).toEqual({
      left: 96,
      right: 96,
    });
  });

  it("lets a long chapter title run to the trailing safe edge", () => {
    expect(
      readerChromeLayout({ ...phone, headerLabel: longTitle }).header,
    ).toEqual({ left: 70, right: 12 });
  });

  it("frees the leading corner once back lives in the system column", () => {
    expect(
      readerChromeLayout({ ...duoOuter, headerLabel: longTitle }).header,
    ).toEqual({ left: 12, right: 96 });
  });
});

describe("reader system column", () => {
  it("only reports a column wide enough for a control", () => {
    expect(readerSystemColumn({ left: 0, right: 84 }, 50)).toEqual({
      side: "right",
      width: 84,
    });
    expect(readerSystemColumn({ left: 47, right: 47 }, 50)).toBeUndefined();
  });
});

describe("reader page frame insets", () => {
  it("fits a single page to the safe area", () => {
    expect(readerPageFrameInsets("single", { left: 0, right: 84 })).toEqual({
      left: 0,
      right: 84,
    });
  });

  it("mirrors the wider inset so a spread stays centered on the hinge", () => {
    expect(readerPageFrameInsets("spread", { left: 0, right: 84 })).toEqual({
      left: 84,
      right: 84,
    });
    expect(readerPageFrameInsets("spread", noInsets)).toEqual(noInsets);
  });
});

describe("stable reader geometry", () => {
  const hidden = {
    top: 0,
    left: 0,
    bottom: 34,
    right: 0,
    columnOcclusionBottom: 0,
  };
  const statusVisible = {
    top: 0,
    left: 0,
    bottom: 34,
    right: 84,
    columnOcclusionBottom: 124,
  };

  it("holds still while a sheet over the reader brings the status bar back", () => {
    const reading = nextStableReaderGeometry(
      undefined,
      "951x669",
      hidden,
      false,
    );

    expect(
      nextStableReaderGeometry(reading, "951x669", statusVisible, true),
    ).toBe(reading);
  });

  it("follows live geometry once no sheet is open", () => {
    const reading = nextStableReaderGeometry(
      undefined,
      "951x669",
      hidden,
      false,
    );

    expect(nextStableReaderGeometry(reading, "951x669", hidden, false)).toBe(
      reading,
    );
    expect(
      nextStableReaderGeometry(reading, "951x669", statusVisible, false)
        .geometry,
    ).toEqual(statusVisible);
  });

  it("recovers the outer column when the insets settle after folding", () => {
    // Folding resizes the window a frame before the safe area catches up.
    const outer = { ...statusVisible, columnOcclusionBottom: 82 };
    const lagging = nextStableReaderGeometry(
      undefined,
      "466x678",
      hidden,
      false,
    );

    expect(
      nextStableReaderGeometry(lagging, "466x678", outer, false).geometry,
    ).toEqual(outer);
  });

  it("follows a new window size even while a sheet is open", () => {
    const inner = nextStableReaderGeometry(undefined, "951x669", hidden, true);
    const outer = { ...statusVisible, columnOcclusionBottom: 82 };

    expect(nextStableReaderGeometry(inner, "466x678", outer, true)).toEqual({
      windowKey: "466x678",
      geometry: outer,
    });
  });
});
