import { describe, expect, it } from "vitest";

import {
  INCOMING_PAGE_LANDING_START_PROGRESS,
  INCOMING_PAGE_PRELUDE_PROGRESS,
  INCOMING_PAGE_SETTLE_DURATION_SECONDS,
  incomingPageDrivenProgress,
  incomingPageRemainingDurationSeconds,
  incomingPageRevealProgress,
  incomingPageShapeProgress,
} from "./page-turn-timing";

describe("incoming page prelude", () => {
  it("holds the original first geometry while revealing it linearly", () => {
    expect(incomingPageShapeProgress(0)).toBe(
      INCOMING_PAGE_LANDING_START_PROGRESS,
    );
    expect(incomingPageShapeProgress(INCOMING_PAGE_PRELUDE_PROGRESS)).toBe(
      INCOMING_PAGE_LANDING_START_PROGRESS,
    );
    expect(incomingPageRevealProgress(0)).toBe(0);
    expect(
      incomingPageRevealProgress(INCOMING_PAGE_PRELUDE_PROGRESS * 0.5),
    ).toBeCloseTo(0.5, 12);
    expect(incomingPageRevealProgress(INCOMING_PAGE_PRELUDE_PROGRESS)).toBe(1);
  });

  it("joins the unchanged old landing curve without an offset", () => {
    const oldLandingProgress = 0.4;
    const compositeProgress =
      INCOMING_PAGE_PRELUDE_PROGRESS +
      (1 - INCOMING_PAGE_PRELUDE_PROGRESS) * oldLandingProgress;
    expect(incomingPageShapeProgress(compositeProgress)).toBeCloseTo(
      INCOMING_PAGE_LANDING_START_PROGRESS +
        (1 - INCOMING_PAGE_LANDING_START_PROGRESS) * oldLandingProgress,
      12,
    );
    expect(incomingPageShapeProgress(1)).toBe(1);
  });

  it("prepends reveal time and then preserves the old settle duration", () => {
    const totalDuration = incomingPageRemainingDurationSeconds(0);
    const preludeDuration =
      totalDuration - INCOMING_PAGE_SETTLE_DURATION_SECONDS;

    expect(
      incomingPageRemainingDurationSeconds(INCOMING_PAGE_PRELUDE_PROGRESS),
    ).toBeCloseTo(INCOMING_PAGE_SETTLE_DURATION_SECONDS, 12);
    expect(incomingPageDrivenProgress(0, preludeDuration)).toBeCloseTo(
      INCOMING_PAGE_PRELUDE_PROGRESS,
      12,
    );
    expect(
      incomingPageDrivenProgress(
        0,
        preludeDuration + INCOMING_PAGE_SETTLE_DURATION_SECONDS * 0.5,
      ),
    ).toBeCloseTo(
      INCOMING_PAGE_PRELUDE_PROGRESS +
        (1 - INCOMING_PAGE_PRELUDE_PROGRESS) * 0.75,
      12,
    );
    expect(incomingPageDrivenProgress(0, totalDuration)).toBe(1);
  });
});
