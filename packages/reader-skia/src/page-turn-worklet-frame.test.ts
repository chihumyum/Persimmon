import {
  advancePageTurnWorklet,
  createPageTurnWorkletState,
  playPageTurnWorklet,
} from "@persimmon/page-turn-core";
import { describe, expect, it } from "vitest";

import { buildPageTurnLookup } from "./page-turn-mesh-data";
import {
  createPageTurnRenderFrame,
  createPageTurnRenderScratch,
  updatePageTurnRenderFrame,
} from "./page-turn-worklet-frame";

describe("UI-runtime visible-face rasterizer", () => {
  it("matches the exhaustive lookup while reusing fixed buffers", () => {
    const state = createPageTurnWorkletState();
    const frame = createPageTurnRenderFrame(384);
    const scratch = createPageTurnRenderScratch(384);
    const mappingIdentity = frame.mapping;
    playPageTurnWorklet(state, 1, false);

    for (const elapsed of [0.2, 0.5, 0.8, 1.1, 1.5]) {
      advancePageTurnWorklet(state, elapsed);
      updatePageTurnRenderFrame(state, frame, scratch, 0, 1);
      const exhaustive = buildPageTurnLookup(state.profile, 384, 0, 1);
      expect(frame.mapping).toBe(mappingIdentity);
      for (let index = 0; index < exhaustive.length; index += 1) {
        expect(frame.mapping[index]).toBeCloseTo(exhaustive[index]!, 4);
      }
    }
  });

  it("clears its shadow after the sheet is fully turned", () => {
    const state = createPageTurnWorkletState();
    const frame = createPageTurnRenderFrame(384);
    const scratch = createPageTurnRenderScratch(384);
    playPageTurnWorklet(state, 1, false);

    for (let frameIndex = 0; frameIndex < 240; frameIndex += 1) {
      advancePageTurnWorklet(state, 1 / 120);
    }
    updatePageTurnRenderFrame(state, frame, scratch, 0, 1);

    expect(frame.shadow[2]).toBe(0);
  });

  it("marks the backward sheet on the right page as front-facing before landing", () => {
    const state = createPageTurnWorkletState();
    const frame = createPageTurnRenderFrame(256);
    const scratch = createPageTurnRenderScratch(256);
    playPageTurnWorklet(state, -1, false);
    for (let frameIndex = 0; frameIndex < 66; frameIndex += 1) {
      advancePageTurnWorklet(state, 1 / 120);
    }
    updatePageTurnRenderFrame(state, frame, scratch, -1, 1);

    const rightPageFaces = frame.mapping
      .filter((_, index) => index % 4 === 3)
      .slice(128)
      .map(Math.sign);

    expect(rightPageFaces.some((face) => face > 0)).toBe(true);
  });

  it("renders backward geometry as the horizontal mirror of forward geometry", () => {
    const sampleCount = 256;
    const forward = createPageTurnWorkletState();
    const backward = createPageTurnWorkletState();
    const forwardFrame = createPageTurnRenderFrame(sampleCount);
    const backwardFrame = createPageTurnRenderFrame(sampleCount);
    const forwardScratch = createPageTurnRenderScratch(sampleCount);
    const backwardScratch = createPageTurnRenderScratch(sampleCount);
    playPageTurnWorklet(forward, 1, false);
    playPageTurnWorklet(backward, -1, false);
    for (let frameIndex = 0; frameIndex < 66; frameIndex += 1) {
      advancePageTurnWorklet(forward, 1 / 120);
      advancePageTurnWorklet(backward, 1 / 120);
    }
    updatePageTurnRenderFrame(forward, forwardFrame, forwardScratch, -1, 1);
    updatePageTurnRenderFrame(backward, backwardFrame, backwardScratch, -1, 1);

    for (let sample = 0; sample < sampleCount; sample += 1) {
      const forwardOffset = sample * 4;
      const backwardOffset = (sampleCount - 1 - sample) * 4;
      const forwardFace = forwardFrame.mapping[forwardOffset + 3]!;
      const backwardFace = backwardFrame.mapping[backwardOffset + 3]!;
      expect(backwardFace === 0).toBe(forwardFace === 0);
      if (forwardFace === 0 || backwardFace === 0) {
        continue;
      }
      expect(backwardFrame.mapping[backwardOffset]).toBeCloseTo(
        forwardFrame.mapping[forwardOffset]!,
        5,
      );
      expect(backwardFrame.mapping[backwardOffset + 2]).toBeCloseTo(
        forwardFrame.mapping[forwardOffset + 2]!,
        5,
      );
      expect(Math.abs(backwardFace)).toBeCloseTo(Math.abs(forwardFace), 5);
      expect(Math.sign(backwardFace)).toBe(-Math.sign(forwardFace));
    }
  });
});
