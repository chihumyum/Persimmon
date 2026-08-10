import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  normalizeAutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";

describe("automatic page turn tuning", () => {
  it("uses stable defaults", () => {
    expect(normalizeAutomaticPageTurnTuning(undefined)).toEqual({
      releaseX: 0.9,
      liftVelocity: 0.5,
      liftToLeft: 4,
      curvatureRelaxation: 10,
      playbackSpeed: 1,
    });
    expect(
      DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftVelocity *
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftToLeft,
    ).toBeCloseTo(2);
  });

  it("keeps the automatic solver within the click-turn release range", () => {
    expect(normalizeAutomaticPageTurnTuning({ releaseX: 2 }).releaseX).toBe(1);
  });

  it("clamps every live control to the supported solver range", () => {
    expect(
      normalizeAutomaticPageTurnTuning({
        releaseX: -1,
        liftVelocity: 20,
        liftToLeft: Number.NaN,
        curvatureRelaxation: 0,
        playbackSpeed: 10,
      }),
    ).toEqual({
      releaseX: 0.15,
      liftVelocity: 5,
      liftToLeft: DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftToLeft,
      curvatureRelaxation: 0.25,
      playbackSpeed: 6,
    });
  });
});
