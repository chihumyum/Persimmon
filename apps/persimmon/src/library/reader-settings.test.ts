import { describe, expect, it } from "vitest";
import {
  BUILTIN_READER_SANS_ID,
  BUILTIN_READER_SERIF_ID,
} from "@persimmon/font-core";

import { normalizeSettings } from "./reader-settings";
import {
  DEFAULT_READER_APPEARANCE,
  DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_PAGE_TURN_TUNING,
  DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_SETTINGS,
} from "./types";

describe("reader settings", () => {
  it("uses the tuned tap and gesture constants as defaults", () => {
    const expected = {
      click: {
        forward: {
          releaseX: 0.9,
          liftVelocity: 0.5,
          liftToLeft: 4,
          curvatureRelaxation: 10,
          playbackSpeed: 1.1,
        },
        backward: {
          releaseX: 0.4,
          curvatureRelaxation: 10,
          incomingLandingStartProgress: 0.15,
          incomingRevealStartProgress: 0,
          incomingRevealEndProgress: 0.15,
          incomingSettleDurationSeconds: 0.7,
          incomingSettleEasingPower: 3,
          playbackSpeed: 1.1,
        },
      },
      gesture: {
        forward: {
          releaseX: 0.4,
          liftVelocity: 1,
          liftToLeft: 1,
          curvatureRelaxation: 10,
          pageWeight: 1,
          commitThreshold: 0.8,
          minimumSpeedScale: 1.25,
          maximumSpeedScale: 5,
          velocityGain: 0.25,
          idleDecaySeconds: 0.1,
        },
        backward: {
          releaseX: 0.6,
          curvatureRelaxation: 10,
          incomingLandingStartProgress: 0.15,
          incomingRevealStartProgress: 0,
          incomingRevealEndProgress: 0.1,
          incomingDragProgressScale: 1,
          incomingDragProgressExponent: 1,
          incomingSettleDurationSeconds: 0.7,
          incomingSettleEasingPower: 2,
          incomingRevertDurationSeconds: 0.7,
          pageWeight: 1,
          commitThreshold: 0.15,
          minimumSpeedScale: 0.8,
          maximumSpeedScale: 5,
          velocityGain: 0.2,
          idleDecaySeconds: 0.1,
        },
      },
    };
    expect(normalizeSettings({}).pageTurnTuning).toEqual(expected);
    expect(DEFAULT_READER_PAGE_TURN_TUNING).toEqual(expected);
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

  it("normalizes appearance and replaces legacy flat tuning values", () => {
    expect(
      normalizeSettings({
        appearance: {
          theme: "not-yet-supported",
          colorMode: "dark",
          fontFamily: "sans",
          fontSize: 100,
          lineHeight: 1.83,
          paragraphSpacing: -1,
          horizontalMargin: 999,
          textAlignment: "end",
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
        fontSize: 48,
        lineHeight: 1.85,
        paragraphSpacing: 0,
        horizontalMargin: 320,
        textAlignment: "end",
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

  it("defaults unknown text alignment values to following the book", () => {
    expect(
      normalizeSettings({
        appearance: { textAlignment: "center" },
      }).appearance.textAlignment,
    ).toBe("book");
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

  it("overwrites saved directional tuning while preserving reading preferences", () => {
    const saved = {
      appearance: { ...DEFAULT_READER_APPEARANCE, fontSize: 24, theme: "cool" },
      layout: "spread",
      pageTurnAnimation: "none",
      rapidPageTurnEnabled: false,
      pageTurnTuning: {
        click: {
          forward: {
            ...DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
            playbackSpeed: 0.6,
          },
          backward: {
            ...DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING,
            playbackSpeed: 2,
            incomingRevealEndProgress: 0.4,
          },
        },
        gesture: {
          forward: {
            ...DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
            minimumSpeedScale: 0.7,
            velocityGain: 1.2,
          },
          backward: {
            ...DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING,
            pageWeight: 2,
          },
        },
      },
    };
    const settings = normalizeSettings(saved);
    expect(settings).toEqual({
      ...saved,
      pageTurnTuning: DEFAULT_READER_PAGE_TURN_TUNING,
    });
    expect(normalizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(
      settings,
    );
  });

  it("falls back for corrupt settings", () => {
    expect(normalizeSettings(null)).toBe(DEFAULT_READER_SETTINGS);
  });
});
