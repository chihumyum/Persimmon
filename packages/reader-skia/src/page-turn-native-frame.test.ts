import {
  INCOMING_PAGE_PRELUDE_PROGRESS,
  advancePageTurnWorklet,
  beginPageTurnWorkletDrag,
  createPageTurnWorkletState,
  movePageTurnWorkletDrag,
  playPageTurnWorklet,
  type PageTurnWorkletState,
} from "@chihumyum/page-turn-core";
import { describe, expect, it } from "vitest";

import {
  NATIVE_PAGE_PROFILE_RUNS,
  createPageTurnNativeFrame,
  resetPageTurnNativeFrameViewport,
  updatePageTurnNativeFrame,
  type PageTurnNativeFrame,
} from "./page-turn-native-frame";

const PROFILE_FLOATS_PER_POINT = 4;
const PROFILE_POINT_COUNT = 65;

function expectRunsToCoverProfile(
  state: PageTurnWorkletState,
  frame: PageTurnNativeFrame,
): number {
  const runs = frame.paperUniforms.runs;
  const activeRuns = [];
  for (let index = 0; index < NATIVE_PAGE_PROFILE_RUNS; index += 1) {
    const offset = index * 4;
    if (runs[offset + 3]! < 0.5) {
      continue;
    }
    activeRuns.push({
      start: runs[offset]!,
      end: runs[offset + 1]!,
      direction: runs[offset + 2]!,
    });
  }

  expect(activeRuns.length).toBeGreaterThan(0);
  expect(activeRuns[0]!.start).toBe(0);
  expect(activeRuns.at(-1)!.end).toBe(PROFILE_POINT_COUNT - 1);
  for (let index = 1; index < activeRuns.length; index += 1) {
    expect(activeRuns[index]!.start).toBe(activeRuns[index - 1]!.end);
  }

  for (let segment = 0; segment < PROFILE_POINT_COUNT - 1; segment += 1) {
    const owners = activeRuns.filter(
      (run) => segment >= run.start && segment < run.end,
    );
    expect(owners).toHaveLength(1);
    const startX =
      frame.paperUniforms.profile[segment * PROFILE_FLOATS_PER_POINT]!;
    const endX =
      frame.paperUniforms.profile[(segment + 1) * PROFILE_FLOATS_PER_POINT]!;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) > 1e-6) {
      expect(owners[0]!.direction).toBe(deltaX > 0 ? 1 : -1);
    }
  }
  return activeRuns.length;
}

describe("native profile page-turn frame", () => {
  it("starts with a complete flat profile", () => {
    const frame = createPageTurnNativeFrame(402, 874, false);

    expect(frame.paperUniforms.profile[0]).toBe(0);
    expect(frame.paperUniforms.profile.at(-4)).toBe(1);
    expect(frame.paperUniforms.runs.slice(0, 4)).toEqual([0, 64, 1, 1]);
    expect(frame.paperRect.width).toBe(0);
  });

  it("reuses the fixed shadow uniform buffer", () => {
    const state = createPageTurnWorkletState();
    const frame = createPageTurnNativeFrame(402, 874, false);
    const shadow = frame.shadowUniforms.shadow;
    const profile = frame.paperUniforms.profile;
    const runs = frame.paperUniforms.runs;
    const paperRect = frame.paperRect;
    playPageTurnWorklet(state, 1, false);
    advancePageTurnWorklet(state, 0.8);
    updatePageTurnNativeFrame(state, frame);

    expect(frame.shadowUniforms.shadow).toBe(shadow);
    expect(frame.paperUniforms.profile).toBe(profile);
    expect(frame.paperUniforms.runs).toBe(runs);
    expect(frame.paperRect).toBe(paperRect);
    expect(runs.filter((_, index) => index % 4 === 3)).toContain(1);
    expect(paperRect.width).toBeGreaterThan(0);
    expect(paperRect.width).toBeLessThanOrEqual(402);
    expect(shadow[1]).toBeGreaterThanOrEqual(0.045);
    expect(shadow[2]).toBeGreaterThan(0);
  });

  it("reveals the untouched old incoming first pose from zero", () => {
    const state = createPageTurnWorkletState();
    const frame = createPageTurnNativeFrame(402, 874, false);
    beginPageTurnWorkletDrag(state, -1, 0.96, 0.5, 0, true);

    updatePageTurnNativeFrame(state, frame);
    const hiddenProfile = [...frame.paperUniforms.profile];
    const hiddenShape = [...state.profile];
    expect(maximumProjectedX(hiddenProfile)).toBeCloseTo(0, 8);
    expect(frame.paperRect.width).toBe(0);

    movePageTurnWorkletDrag(
      state,
      0.86,
      0.5,
      INCOMING_PAGE_PRELUDE_PROGRESS * 0.5,
      0.1,
    );
    updatePageTurnNativeFrame(state, frame);
    const halfProfile = [...frame.paperUniforms.profile];
    expect(state.profile).toEqual(new Float32Array(hiddenShape));

    movePageTurnWorkletDrag(
      state,
      0.76,
      0.5,
      INCOMING_PAGE_PRELUDE_PROGRESS,
      0.2,
    );
    updatePageTurnNativeFrame(state, frame);
    const joinedProfile = [...frame.paperUniforms.profile];
    const joinedMaximumX = maximumProjectedX(joinedProfile);
    expect(maximumProjectedX(halfProfile)).toBeCloseTo(joinedMaximumX * 0.5, 6);
    expect(joinedMaximumX).toBeGreaterThan(0.25);
    expect(state.profile).toEqual(new Float32Array(hiddenShape));

    movePageTurnWorkletDrag(state, 0.96, 0.5, 0, 0.3);
    updatePageTurnNativeFrame(state, frame);
    expect(maximumProjectedX(frame.paperUniforms.profile)).toBeCloseTo(0, 8);
    expect(frame.paperRect.width).toBe(0);
  });

  it("clears the center-spine shadow after the sheet is fully turned", () => {
    const state = createPageTurnWorkletState();
    const frame = createPageTurnNativeFrame(402, 874, false);
    playPageTurnWorklet(state, 1, false);

    for (let frameIndex = 0; frameIndex < 240; frameIndex += 1) {
      advancePageTurnWorklet(state, 1 / 120);
    }
    updatePageTurnNativeFrame(state, frame);

    expect(frame.shadowUniforms.shadow[2]).toBe(0);
  });

  it("reconfigures a persistent frame without replacing its buffers", () => {
    const frame = createPageTurnNativeFrame(402, 874, false);
    const paperGeometry = frame.paperUniforms.geometry;
    const paperPageSize = frame.paperUniforms.pageSize;
    const shadowGeometry = frame.shadowUniforms.geometry;
    const shadowPageSize = frame.shadowUniforms.pageSize;
    const paperRect = frame.paperRect;

    resetPageTurnNativeFrameViewport(frame, 1_000, 700, true);

    expect(frame.paperUniforms.geometry).toBe(paperGeometry);
    expect(frame.paperUniforms.pageSize).toBe(paperPageSize);
    expect(frame.shadowUniforms.geometry).toBe(shadowGeometry);
    expect(frame.shadowUniforms.pageSize).toBe(shadowPageSize);
    expect(frame.paperRect).toBe(paperRect);
    expect(paperGeometry).toEqual([500, 500, 64, NATIVE_PAGE_PROFILE_RUNS]);
    expect(paperPageSize).toEqual([1_000, 700]);
    expect(shadowGeometry).toEqual([500, 500, -1, 2]);
    expect(shadowPageSize).toEqual([1_000, 700]);
    expect(paperRect).toEqual({ x: 0, y: 0, width: 0, height: 700 });
  });

  it("covers every curve segment during taps, drags, and incoming settles", () => {
    let maximumRunCount = 0;
    const verify = (
      state: PageTurnWorkletState,
      frame: PageTurnNativeFrame,
    ) => {
      updatePageTurnNativeFrame(state, frame);
      maximumRunCount = Math.max(
        maximumRunCount,
        expectRunsToCoverProfile(state, frame),
      );
    };

    for (const direction of [1, -1] as const) {
      const state = createPageTurnWorkletState();
      const frame = createPageTurnNativeFrame(402, 874, direction === -1);
      playPageTurnWorklet(state, direction, false);
      for (let index = 0; index < 360; index += 1) {
        verify(state, frame);
        advancePageTurnWorklet(state, 1 / 240);
      }
    }

    const dragged = createPageTurnWorkletState();
    const dragFrame = createPageTurnNativeFrame(402, 874, false);
    beginPageTurnWorkletDrag(dragged, 1, 0.96, 0.5, 0, false);
    for (let index = 0; index <= 360; index += 1) {
      const progress = index / 360;
      movePageTurnWorkletDrag(
        dragged,
        0.96 - progress * 1.7,
        0.5 - progress * 0.3,
        progress,
        (index + 1) / 240,
      );
      verify(dragged, dragFrame);
    }

    const incoming = createPageTurnWorkletState();
    const incomingFrame = createPageTurnNativeFrame(402, 874, false);
    beginPageTurnWorkletDrag(incoming, -1, 0.96, 0.5, 0, true);
    for (let index = 0; index <= 360; index += 1) {
      const progress = index / 360;
      movePageTurnWorkletDrag(
        incoming,
        0.96 - progress * 1.7,
        0.5,
        progress,
        (index + 1) / 240,
      );
      verify(incoming, incomingFrame);
    }

    expect(maximumRunCount).toBeGreaterThan(1);
    expect(maximumRunCount).toBeLessThanOrEqual(NATIVE_PAGE_PROFILE_RUNS);
  });
});

function maximumProjectedX(profile: readonly number[]): number {
  let maximum = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < profile.length; offset += 4) {
    maximum = Math.max(maximum, profile[offset]!);
  }
  return maximum;
}
