import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTOMATIC_PAGE_TURN_TUNING,
  normalizeAutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";

describe("automatic page turn tuning", () => {
  it("uses stable defaults", () => {
    expect(normalizeAutomaticPageTurnTuning(undefined)).toEqual({
      releaseX: 0.72,
      liftVelocity: 1.5,
      liftToLeft: 2.2,
      curvatureRelaxation: 6.75,
      playbackSpeed: 1.3,
    });
    expect(
      DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftVelocity *
        DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftToLeft,
    ).toBeCloseTo(3.3);
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
      releaseX: 0.58,
      liftVelocity: 1.8,
      liftToLeft: DEFAULT_AUTOMATIC_PAGE_TURN_TUNING.liftToLeft,
      curvatureRelaxation: 3.5,
      playbackSpeed: 2,
    });
  });
});
