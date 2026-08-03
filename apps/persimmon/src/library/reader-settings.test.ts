import { describe, expect, it } from "vitest";
import {
  BUILTIN_READER_SANS_ID,
  BUILTIN_READER_SERIF_ID,
} from "@persimmon/font-core";

import { normalizeSettings } from "./reader-settings";
import {
  DEFAULT_READER_APPEARANCE,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
} from "./types";

describe("reader settings", () => {
  it("uses the tuned gesture constants as defaults", () => {
    expect(normalizeSettings({}).pageTurnTuning.gesture).toEqual({
      releaseX: 0.69,
      liftVelocity: 0.9,
      liftToLeft: 1.65,
      curvatureRelaxation: 7,
      pageWeight: 0.6,
      commitThreshold: 0.53,
      minimumSpeedScale: 0.95,
      maximumSpeedScale: 2,
      velocityGain: 0.6,
      idleDecaySeconds: 0.09,
    });
  });

  it("migrates old settings with default page-turn tuning", () => {
    expect(normalizeSettings({ fontSize: 22, layout: "spread" })).toEqual({
      appearance: {
        ...DEFAULT_READER_APPEARANCE,
        fontSize: 22,
      },
      layout: "spread",
      pageTurnAnimation: "natural",
      rapidPageTurnEnabled: true,
      pageTurnTuning: DEFAULT_READER_PAGE_TURN_TUNING,
    });
  });

  it("normalizes persisted appearance and tuning values", () => {
    expect(
      normalizeSettings({
        appearance: {
          theme: "not-yet-supported",
          colorMode: "dark",
          fontFamily: "sans",
          fontSize: 100,
          lineHeight: 1.83,
          paragraphSpacing: -1,
          horizontalMargin: 70,
          progressDisplay: "both",
        },
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
      appearance: {
        theme: "warm",
        colorMode: "dark",
        font: {
          selectedFontId: BUILTIN_READER_SANS_ID,
          useBookEmbeddedFonts: true,
        },
        fontSize: 32,
        lineHeight: 1.85,
        paragraphSpacing: 0,
        horizontalMargin: 72,
        progressDisplay: "both",
      },
      layout: "single",
      pageTurnAnimation: "natural",
      rapidPageTurnEnabled: true,
      pageTurnTuning: DEFAULT_READER_PAGE_TURN_TUNING,
    });
  });

  it("normalizes the page-turn animation and follows-system color mode", () => {
    expect(
      normalizeSettings({
        appearance: { colorMode: "unknown" },
        pageTurnAnimation: "none",
      }),
    ).toMatchObject({
      appearance: {
        theme: "warm",
        colorMode: "system",
      },
      pageTurnAnimation: "none",
    });
  });

  it("defaults rapid page turns on while preserving an explicit opt-out", () => {
    expect(normalizeSettings({}).rapidPageTurnEnabled).toBe(true);
    expect(
      normalizeSettings({ rapidPageTurnEnabled: false }).rapidPageTurnEnabled,
    ).toBe(false);
    expect(
      normalizeSettings({ rapidPageTurnEnabled: "no" }).rapidPageTurnEnabled,
    ).toBe(true);
  });

  it("preserves the supported cool reader theme", () => {
    expect(
      normalizeSettings({
        appearance: { theme: "cool" },
      }).appearance.theme,
    ).toBe("cool");
  });

  it("keeps new font settings and migrates old top-level font settings", () => {
    expect(
      normalizeSettings({
        appearance: {
          font: {
            selectedFontId: "user:my-font",
            useBookEmbeddedFonts: true,
          },
        },
      }).appearance.font,
    ).toEqual({
      selectedFontId: "user:my-font",
      useBookEmbeddedFonts: true,
    });

    expect(
      normalizeSettings({
        fontFamily: "sans",
      }).appearance.font,
    ).toEqual({
      selectedFontId: BUILTIN_READER_SANS_ID,
      useBookEmbeddedFonts: true,
    });
    expect(normalizeSettings({}).appearance.font.selectedFontId).toBe(
      BUILTIN_READER_SERIF_ID,
    );
  });

  it("stores raw gesture constants and keeps speed bounds ordered", () => {
    expect(
      normalizeSettings({
        appearance: DEFAULT_READER_APPEARANCE,
        pageTurnTuning: {
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

  it("ignores obsolete rapid and click tuning while preserving gestures", () => {
    const gesture = {
      ...DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
      liftVelocity: 1.5,
    };

    expect(
      normalizeSettings({
        pageTurnTuning: {
          rapid: {
            releaseX: 1,
            liftVelocity: 1.8,
            liftToLeft: 2.6,
            curvatureRelaxation: 14,
            playbackSpeed: 2,
          },
          click: {
            releaseX: 0.58,
            liftVelocity: 0.7,
            liftToLeft: 1.4,
            curvatureRelaxation: 14,
            playbackSpeed: 2,
          },
          gesture,
        },
      }).pageTurnTuning,
    ).toEqual({
      gesture,
    });
  });

  it("falls back for corrupt settings", () => {
    expect(normalizeSettings(null)).toBe(DEFAULT_READER_SETTINGS);
  });
});
