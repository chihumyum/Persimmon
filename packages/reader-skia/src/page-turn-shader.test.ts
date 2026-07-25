import {
  DEFAULT_PAGE_PROFILE_POINTS,
  NaturalPageTurnController,
  RolledPageStrip,
} from "@persimmon/page-turn-core";
import { describe, expect, it } from "vitest";

import {
  NATURAL_PAGE_SHADOW_SHADER,
  mirrorPageTurnProfile,
  packPageTurnProfile,
  summarizePageTurnShadow,
} from "./page-turn-shader";
import {
  buildPageTurnLookup,
  pageTurnLookupSampleCount,
  PAGE_TURN_SEGMENT_COUNT,
} from "./page-turn-mesh-data";
import {
  pageTurnCameraBookXForLayout,
  projectPageTurnBookX,
} from "./page-turn-perspective";

describe("natural Skia page shader input", () => {
  it("removes the fixed spine shadow when no turn shadow is active", () => {
    expect(NATURAL_PAGE_SHADOW_SHADER).toContain("shadow.z * 0.32");
    expect(NATURAL_PAGE_SHADOW_SHADER).toContain("bookX * shadow.w");
  });

  it("uses approximately one lookup sample per phone layout pixel", () => {
    expect(pageTurnLookupSampleCount(360)).toBe(384);
    expect(pageTurnLookupSampleCount(402)).toBe(416);
    expect(pageTurnLookupSampleCount(430)).toBe(448);
    expect(pageTurnLookupSampleCount(1_024)).toBe(512);
  });

  it("preserves all reference profile points and their normals", () => {
    const strip = new RolledPageStrip();
    strip.setPressedEdge(0.52);
    const packed = packPageTurnProfile(strip.getPoints());

    expect(packed).toHaveLength(DEFAULT_PAGE_PROFILE_POINTS * 4);
    expect(packed[0]).toBeCloseTo(0, 6);
    expect(packed[1]).toBeCloseTo(0, 6);
    expect(
      Math.max(...strip.getPoints().map((point) => point.z)),
    ).toBeGreaterThan(0.35);
    for (let offset = 0; offset < packed.length; offset += 4) {
      expect(Math.hypot(packed[offset + 2]!, packed[offset + 3]!)).toBeCloseTo(
        1,
        5,
      );
    }
  });

  it("packs one depth-visible mapping for every screen-x sample", () => {
    const strip = new RolledPageStrip();
    strip.setPressedEdge(0.52);
    const packed = packPageTurnProfile(strip.getPoints());
    const lookup = buildPageTurnLookup(packed, PAGE_TURN_SEGMENT_COUNT);

    expect(PAGE_TURN_SEGMENT_COUNT).toBe(DEFAULT_PAGE_PROFILE_POINTS - 1);
    expect(lookup).toHaveLength(PAGE_TURN_SEGMENT_COUNT * 4);
    for (let offset = 0; offset < lookup.length; offset += 4) {
      expect(lookup[offset]).toBeGreaterThanOrEqual(0);
      expect(lookup[offset]).toBeLessThanOrEqual(1);
      expect(lookup[offset + 2]).toBeGreaterThanOrEqual(0.8);
      expect(lookup[offset + 2]).toBeLessThanOrEqual(1);
    }
  });

  it("keeps depth-visible paper coverage opaque", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0.4, 0.52);
    const frontLookup = buildPageTurnLookup(
      packPageTurnProfile(strip.getPoints()),
      128,
    );
    strip.setTurnProgress(0.75, 0.52);
    const backLookup = buildPageTurnLookup(
      packPageTurnProfile(strip.getPoints()),
      128,
    );
    const faceAndDepth = [...frontLookup, ...backLookup].filter(
      (_, index) => index % 4 === 3,
    );
    const faceCoverage = faceAndDepth.map(Math.sign);

    expect(faceCoverage).toContain(1);
    expect(
      faceCoverage.every((face) => face === -1 || face === 0 || face === 1),
    ).toBe(true);
    expect(faceAndDepth.some((faceDepth) => Math.abs(faceDepth) > 1.25)).toBe(
      true,
    );
  });

  it("samples both physical pages for a spread turn", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0.55, 0.52);
    const lookup = buildPageTurnLookup(
      packPageTurnProfile(strip.getPoints()),
      256,
      -1,
      1,
    );
    const coveredFaces = lookup
      .filter((value, index) => index % 4 === 3 && value !== 0)
      .map(Math.sign);

    expect(lookup).toHaveLength(256 * 4);
    expect(coveredFaces).toContain(1);
    expect(coveredFaces).toContain(-1);
  });

  it("mirrors geometry and normals without changing lift", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0.6, 0.52);
    const packed = packPageTurnProfile(strip.getPoints());
    const mirrored = mirrorPageTurnProfile(packed);

    for (let offset = 0; offset < packed.length; offset += 4) {
      expect(mirrored[offset]).toBeCloseTo(1 - packed[offset]!, 6);
      expect(mirrored[offset + 1]).toBeCloseTo(packed[offset + 1]!, 6);
      expect(mirrored[offset + 2]).toBeCloseTo(-packed[offset + 2]!, 6);
      expect(mirrored[offset + 3]).toBeCloseTo(packed[offset + 3]!, 6);
    }
  });

  it("reflects an incoming page across the virtual spine", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0.72, 0.52);
    const packed = packPageTurnProfile(strip.getPoints());
    const incoming = packPageTurnProfile(strip.getPoints(), -1);

    for (let offset = 0; offset < packed.length; offset += 4) {
      expect(incoming[offset]).toBeCloseTo(-packed[offset]!, 6);
      expect(incoming[offset + 1]).toBeCloseTo(packed[offset + 1]!, 6);
      expect(incoming[offset + 2]).toBeCloseTo(-packed[offset + 2]!, 6);
      expect(incoming[offset + 3]).toBeCloseTo(packed[offset + 3]!, 6);
    }
    expect(incoming.at(-4)).toBeGreaterThan(0);
  });

  it("uses the reference shadow summary", () => {
    const strip = new RolledPageStrip();
    strip.setPressedEdge(0.52, 1 / 60);
    const shadow = summarizePageTurnShadow(
      strip.getPoints(),
      strip.getMetrics(),
    );

    expect(shadow.center).toBeGreaterThan(0);
    expect(shadow.width).toBeGreaterThanOrEqual(0.045);
    expect(shadow.width).toBeLessThanOrEqual(0.28);
    expect(shadow.strength).toBeGreaterThan(0);
    expect(shadow.strength).toBeLessThanOrEqual(0.34);
  });

  it("anchors the cast shadow on the projected silhouette", () => {
    const strip = new RolledPageStrip();
    strip.setTurnProgress(0.25, 0.96, 1 / 60);
    const points = strip.getPoints();
    const metrics = strip.getMetrics();
    const spreadCamera = pageTurnCameraBookXForLayout(true);
    const physicalSilhouette = Math.max(...points.map((point) => point.x));
    const projectedSilhouette = Math.max(
      ...points.map((point) =>
        projectPageTurnBookX(point.x, point.z, spreadCamera),
      ),
    );
    const shadow = summarizePageTurnShadow(points, metrics, 1, spreadCamera);

    // A raised roll is drawn well outside its physical footprint, so a shadow
    // left at the physical edge would sit visibly inside the paper.
    expect(projectedSilhouette).toBeGreaterThan(physicalSilhouette + 0.1);
    expect(shadow.center).toBeCloseTo(projectedSilhouette, 6);
  });

  it("keeps a flat sheet's shadow on its unprojected edge", () => {
    const strip = new RolledPageStrip();
    strip.setPressedEdge(1, 1 / 60);
    const shadow = summarizePageTurnShadow(
      strip.getPoints(),
      strip.getMetrics(),
      1,
      pageTurnCameraBookXForLayout(true),
    );

    expect(shadow.center).toBeCloseTo(1, 6);
  });

  it("boosts a flattening roll, fades on reversal, and clears after crossing", () => {
    const controller = new NaturalPageTurnController();
    controller.beginDrag(0.96, 0.5, 0);
    for (let index = 1; index <= 21; index += 1) {
      controller.moveDrag(0.96 - index * 0.045, 0.5, index / 240);
    }
    controller.endDrag(0.09);

    const samples: {
      edgeX: number;
      velocityX: number;
      strength: number;
    }[] = [];
    for (let frame = 0; frame < 32; frame += 1) {
      controller.advance(1 / 240);
      const metrics = controller.getMetrics();
      samples.push({
        edgeX: metrics.edgeX,
        velocityX: metrics.edgeVelocityX,
        strength: summarizePageTurnShadow(controller.getPoints(), metrics)
          .strength,
      });
    }

    const outward = samples.reduce((peak, sample) =>
      sample.velocityX > 0 && sample.strength > peak.strength ? sample : peak,
    );
    const reversing = samples.find(
      (sample) => sample.edgeX > 0 && sample.velocityX < -4,
    );
    const crossed = samples.find((sample) => sample.edgeX < -0.035);

    expect(outward.velocityX).toBeGreaterThan(0);
    expect(outward.strength).toBeGreaterThan(0.2);
    expect(reversing).toBeDefined();
    expect(reversing!.strength).toBeLessThan(outward.strength);
    expect(crossed).toBeDefined();
    expect(crossed!.strength).toBe(0);
  });
});
