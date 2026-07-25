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
    // before the sheet flips over the spine the reader sees its front, after it
    // sees the back
    strip.setTurnProgress(0.15, 0.52);
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

  it("keeps lifted flat front and back faces at the captured paper color", () => {
    expect(liftedFlatFaceLight(true, 1)).toBe(1);
    expect(liftedFlatFaceLight(false, 1)).toBe(1);
  });

  it("smoothly restores the back-face paper color as it flattens", () => {
    const lights = [0, 0.25, 0.5, 0.75, 1].map((normalZ) =>
      liftedFlatFaceLight(false, normalZ),
    );

    for (let index = 1; index < lights.length; index += 1) {
      expect(lights[index]).toBeGreaterThan(lights[index - 1]!);
    }
    expect(lights.at(-1)).toBe(1);
  });

  it("samples both physical pages for a spread turn", () => {
    const strip = new RolledPageStrip();
    // the roll straddles the spine here, so paper sits on both physical pages
    strip.setTurnProgress(0.35, 0.52);
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
    strip.setTurnProgress(0.15, 0.96, 1 / 60);
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

  it("boosts flattening without reversing the edge and clears after crossing", () => {
    const controller = new NaturalPageTurnController();
    controller.beginDrag(0.96, 0.5, 0);
    for (let index = 1; index <= 21; index += 1) {
      controller.moveDrag(0.96 - index * 0.045, 0.5, index / 240);
    }
    controller.endDrag(0.09);

    const samples: {
      edgeX: number;
      silhouette: number;
      strength: number;
      flatteningBoost: number;
    }[] = [];
    for (let frame = 0; frame < 32; frame += 1) {
      controller.advance(1 / 240);
      const metrics = controller.getMetrics();
      const shadow = summarizePageTurnShadow(controller.getPoints(), metrics);
      const withoutFlattening = summarizePageTurnShadow(
        controller.getPoints(),
        { ...metrics, flatteningRate: 0 },
      );
      samples.push({
        edgeX: metrics.edgeX,
        silhouette: shadow.center,
        strength: shadow.strength,
        flatteningBoost: shadow.strength - withoutFlattening.strength,
      });
    }

    const flattening = samples.reduce((peak, sample) =>
      sample.flatteningBoost > peak.flatteningBoost ? sample : peak,
    );
    const crossed = samples.find((sample) => sample.edgeX < -0.035);

    // The shadow rides the silhouette, which sweeps toward the spine. An
    // opening roll pushes its outer wall out by a hair on the way - the same
    // outward push the shadow strength already models - but never enough to
    // read as the page backing up. The free edge itself is inside the roll and
    // is free to swing.
    const silhouetteRebound = samples.reduce(
      (worst, sample, index) =>
        index === 0
          ? worst
          : Math.max(worst, sample.silhouette - samples[index - 1]!.silhouette),
      0,
    );
    expect(silhouetteRebound).toBeLessThan(0.02);
    expect(flattening.flatteningBoost).toBeGreaterThan(0);
    expect(crossed).toBeDefined();
    expect(crossed!.strength).toBe(0);
  });
});

function liftedFlatFaceLight(frontFacing: boolean, normalZ: number): number {
  const profile = new Array<number>(DEFAULT_PAGE_PROFILE_POINTS * 4);
  for (let index = 0; index < DEFAULT_PAGE_PROFILE_POINTS; index += 1) {
    const material = index / (DEFAULT_PAGE_PROFILE_POINTS - 1);
    const offset = index * 4;
    profile[offset] = frontFacing ? material : 1 - material;
    profile[offset + 1] = 0.4;
    profile[offset + 2] = 0;
    profile[offset + 3] = normalZ;
  }

  const lookup = buildPageTurnLookup(profile, 128);
  const coveredLight = lookup.filter(
    (_, index) => index % 4 === 2 && lookup[index + 1] !== 0,
  );
  expect(coveredLight.length).toBeGreaterThan(0);
  return Math.max(...coveredLight);
}
