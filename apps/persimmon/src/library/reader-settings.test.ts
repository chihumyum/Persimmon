import { describe, expect, it } from "vitest";

import { normalizeSettings } from "./reader-settings";
import {
  DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
} from "./types";

describe("reader settings", () => {
  it("migrates old settings with default page-turn tuning", () => {
    expect(normalizeSettings({ fontSize: 22, layout: "spread" })).toEqual({
      fontSize: 22,
      layout: "spread",
      pageTurnTuning: DEFAULT_READER_PAGE_TURN_TUNING,
    });
  });

  it("normalizes persisted tuning values", () => {
    expect(
      normalizeSettings({
        fontSize: 100,
        layout: "unknown",
        pageTurnTuning: {
          releaseX: 0,
          liftVelocity: 1.5,
          liftToLeft: Number.NaN,
          flattenSpeed: 4,
          playbackSpeed: 4,
        },
      }),
    ).toEqual({
      fontSize: 30,
      layout: "single",
      pageTurnTuning: {
        click: {
          releaseX: 0.58,
          liftVelocity: 1.5,
          liftToLeft: DEFAULT_READER_CLICK_PAGE_TURN_TUNING.liftToLeft,
          curvatureRelaxation: 14,
          playbackSpeed: 2,
        },
        gesture: DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
      },
    });
  });

  it("stores raw gesture constants and keeps speed bounds ordered", () => {
    expect(
      normalizeSettings({
        fontSize: 20,
        pageTurnTuning: {
          click: DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
          gesture: {
            ...DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
            curvatureRelaxation: 20,
            commitThreshold: 0,
            minimumSpeedScale: 1.4,
            maximumSpeedScale: 0.5,
            idleDecaySeconds: 0.12,
          },
        },
      }).pageTurnTuning.gesture,
    ).toEqual({
      ...DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
      curvatureRelaxation: 14,
      commitThreshold: 0.4,
      minimumSpeedScale: 1.4,
      maximumSpeedScale: 1.4,
      idleDecaySeconds: 0.12,
    });
  });

  it("falls back for corrupt settings", () => {
    expect(normalizeSettings(null)).toBe(DEFAULT_READER_SETTINGS);
  });
});
