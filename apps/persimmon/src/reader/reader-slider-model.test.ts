import { describe, expect, it } from "vitest";

import {
  readerSliderRatioAtPageX,
  readerSliderTrackMetrics,
  readerSliderValueAtPageX,
  stepReaderSliderValue,
} from "./reader-slider-model";

describe("reader slider coordinate model", () => {
  it("uses the same inset range for the finger and thumb center", () => {
    const track = readerSliderTrackMetrics(100, 200, 16);

    expect(track).toEqual({ left: 108, width: 184 });
    expect(readerSliderRatioAtPageX(154, track)).toBe(0.25);
    expect(readerSliderValueAtPageX(108, track, 16, 32, 1)).toBe(16);
    expect(readerSliderValueAtPageX(200, track, 16, 32, 1)).toBe(24);
    expect(readerSliderValueAtPageX(292, track, 16, 32, 1)).toBe(32);
  });

  it("depends on absolute finger position rather than a child-local location", () => {
    const firstTrack = readerSliderTrackMetrics(40, 320);
    const movedTrack = readerSliderTrackMetrics(140, 320);
    const ratio = 0.625;

    expect(
      readerSliderValueAtPageX(
        firstTrack.left + firstTrack.width * ratio,
        firstTrack,
        1.25,
        2.1,
        0.05,
      ),
    ).toBe(1.8);
    expect(
      readerSliderValueAtPageX(
        movedTrack.left + movedTrack.width * ratio,
        movedTrack,
        1.25,
        2.1,
        0.05,
      ),
    ).toBe(1.8);
  });

  it("clamps and steps values without floating-point drift", () => {
    const track = readerSliderTrackMetrics(0, 160);

    expect(readerSliderValueAtPageX(-100, track, 0, 2, 0.1)).toBe(0);
    expect(readerSliderValueAtPageX(1_000, track, 0, 2, 0.1)).toBe(2);
    expect(stepReaderSliderValue(1.65, 1, 1.25, 2.1, 0.05)).toBe(1.7);
  });
});
