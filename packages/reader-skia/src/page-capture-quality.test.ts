import { describe, expect, it } from "vitest";

import { selectPageCaptureQuality } from "./page-capture-quality";

describe("page capture quality policy", () => {
  it("gives a gesture the highest practical device scale", () => {
    const quality = selectPageCaptureQuality({
      tier: "active",
      inputKind: "gesture",
      devicePixelRatio: 3,
      recentStartsPerSecond: 12,
      activeTurnCount: 8,
      maxPerspectiveScale: 1.34,
    });

    expect(quality).toMatchObject({
      desiredScale: 3,
      minimumScale: 1,
    });
    expect(quality.idealPerspectiveScale).toBeCloseTo(4.02);
  });

  it("reduces only newly requested tap captures as real pressure rises", () => {
    expect(
      selectPageCaptureQuality({
        tier: "active",
        inputKind: "tap",
        devicePixelRatio: 3,
        recentStartsPerSecond: 1,
        activeTurnCount: 1,
      }).desiredScale,
    ).toBe(2.5);
    expect(
      selectPageCaptureQuality({
        tier: "active",
        inputKind: "tap",
        devicePixelRatio: 3,
        recentStartsPerSecond: 3,
        activeTurnCount: 2,
      }).desiredScale,
    ).toBe(2);
    expect(
      selectPageCaptureQuality({
        tier: "active",
        inputKind: "tap",
        devicePixelRatio: 3,
        recentStartsPerSecond: 5,
        activeTurnCount: 4,
      }).desiredScale,
    ).toBe(1.5);
  });

  it("caps the two opportunistic tiers without guaranteeing residency", () => {
    expect(
      selectPageCaptureQuality({
        tier: "prefetch",
        devicePixelRatio: 3,
      }),
    ).toMatchObject({ desiredScale: 2, minimumScale: 0 });
    expect(
      selectPageCaptureQuality({
        tier: "background",
        devicePixelRatio: 3,
      }),
    ).toMatchObject({ desiredScale: 1.5, minimumScale: 0 });
  });

  it("never asks an active turn for less than 1x", () => {
    expect(
      selectPageCaptureQuality({
        tier: "active",
        inputKind: "gesture",
        devicePixelRatio: 0.75,
      }),
    ).toMatchObject({ desiredScale: 1, minimumScale: 1 });
    expect(
      selectPageCaptureQuality({
        tier: "active",
        inputKind: "tap",
        devicePixelRatio: Number.NaN,
      }),
    ).toMatchObject({ desiredScale: 1, minimumScale: 1 });
  });

  it("reports ideal perspective demand separately from its practical cap", () => {
    expect(
      selectPageCaptureQuality({
        tier: "active",
        inputKind: "gesture",
        devicePixelRatio: 2,
        maxPerspectiveScale: 1.34,
      }),
    ).toEqual({
      desiredScale: 2,
      minimumScale: 1,
      idealPerspectiveScale: 2.68,
    });
  });
});
