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
});
