import { describe, expect, it } from "vitest";

import { NaturalPageTurnController } from "./natural-page-turn-controller";
import { DEFAULT_PAGE_TURN_TUNING } from "./page-turn-gesture";
import {
  advancePageTurnWorklet,
  beginPageTurnWorkletDrag,
  catchUpPageTurnWorklet,
  createPageTurnWorkletState,
  endPageTurnWorkletDrag,
  movePageTurnWorkletDrag,
  playPageTurnWorklet,
  playReleasedPageTurnWorklet,
  setPageTurnWorkletTuning,
  PAGE_TURN_WORKLET_PRESS,
  PAGE_TURN_WORKLET_REVERT,
  PAGE_TURN_WORKLET_TURN,
} from "./page-turn-worklet";

describe("UI-runtime page-turn engine", () => {
  it("matches the reference programmatic turn without per-frame allocation", () => {
    const reference = new NaturalPageTurnController();
    const worklet = createPageTurnWorkletState();
    reference.play();
    playPageTurnWorklet(worklet, 1, false);

    for (let frame = 0; frame < 120; frame += 1) {
      reference.advance(1 / 60);
      advancePageTurnWorklet(worklet, 1 / 60);
      expectProfilesToMatch(reference, worklet.profile);
      const metrics = reference.getMetrics();
      expect(worklet.edgeVelocityX).toBeCloseTo(metrics.edgeVelocityX, 2);
      expect(worklet.curvature).toBeCloseTo(metrics.curvature, 5);
      expect(worklet.flatteningRate).toBeCloseTo(metrics.flatteningRate, 3);
    }
    expect(worklet.outcome).toBe(1);
  });

  it("matches the reference drag, release, and settle sequence", () => {
    const tuning = {
      ...DEFAULT_PAGE_TURN_TUNING,
      curvatureRelaxation: 10.5,
      pageWeight: 0.85,
      gestureCommitThreshold: 0.7,
      gestureMinimumSpeedScale: 0.8,
      gestureMaximumSpeedScale: 2.35,
      gestureVelocityGain: 0.75,
      gestureIdleDecaySeconds: 0.12,
    };
    const reference = new NaturalPageTurnController(tuning);
    const worklet = createPageTurnWorkletState(tuning);
    reference.beginDrag(0.92, 0.72, 1);
    beginPageTurnWorkletDrag(worklet, 1, 0.92, 0.72, 1, false);

    for (let index = 1; index <= 18; index += 1) {
      const time = 1 + index / 120;
      const x = 0.92 - index * 0.075;
      const y = 0.72 - index * 0.012;
      reference.moveDrag(x, y, time);
      movePageTurnWorkletDrag(worklet, x, y, 0, time);
      expectProfilesToMatch(reference, worklet.profile);
    }
    expect(worklet.dragTurnProgress).toBeGreaterThan(0);
    expect(endPageTurnWorkletDrag(worklet, 1.17)).toBe(
      reference.endDrag(1.17) === "turn" ? 1 : -1,
    );

    for (let frame = 0; frame < 120; frame += 1) {
      reference.advance(1 / 60);
      advancePageTurnWorklet(worklet, 1 / 60);
      expectProfilesToMatch(reference, worklet.profile);
    }
    expect(worklet.outcome).toBe(1);
  });

  it("updates live automatic-turn tuning without replacing frame buffers", () => {
    const worklet = createPageTurnWorkletState();
    const profile = worklet.profile;

    setPageTurnWorkletTuning(worklet, {
      ...DEFAULT_PAGE_TURN_TUNING,
      releaseX: 0.61,
      liftVelocity: 1.7,
      liftToLeft: 2.45,
      curvatureRelaxation: 11.5,
      pageWeight: 1,
      gestureCommitThreshold: 0.68,
      gestureMinimumSpeedScale: 0.8,
      gestureMaximumSpeedScale: 2.4,
      gestureVelocityGain: 0.75,
      gestureIdleDecaySeconds: 0.12,
    });

    expect(worklet).toMatchObject({
      tuningReleaseX: 0.61,
      tuningLiftVelocity: 1.7,
      tuningLiftToLeft: 2.45,
      tuningCurvatureRelaxation: 11.5,
      tuningPageWeight: 1,
      tuningGestureCommitThreshold: 0.68,
      tuningGestureMinimumSpeedScale: 0.8,
      tuningGestureMaximumSpeedScale: 2.4,
      tuningGestureVelocityGain: 0.75,
      tuningGestureIdleDecaySeconds: 0.12,
    });
    expect(worklet.profile).toBe(profile);
  });

  it("never routes a pan release through the automatic click phase", () => {
    const untouched = createPageTurnWorkletState();
    beginPageTurnWorkletDrag(untouched, 1, 0.95, 0.5, 0, false);

    expect(endPageTurnWorkletDrag(untouched, 0.05)).toBe(-1);
    expect(untouched.phase).toBe(PAGE_TURN_WORKLET_REVERT);
    expect(untouched.phase).not.toBe(PAGE_TURN_WORKLET_PRESS);

    const flick = createPageTurnWorkletState();
    beginPageTurnWorkletDrag(flick, 1, 0.95, 0.5, 0, false);
    movePageTurnWorkletDrag(flick, 0.2, 0.5, 0, 0.01);

    expect(endPageTurnWorkletDrag(flick, 0.01)).toBe(1);
    expect(flick.phase).toBe(PAGE_TURN_WORKLET_TURN);
    expect(flick.phase).not.toBe(PAGE_TURN_WORKLET_PRESS);
    expect(flick.driveSpeedScale).toBeGreaterThan(
      flick.tuningGestureMinimumSpeedScale,
    );
  });

  it("starts a queued flick from its release pose and velocity", () => {
    const worklet = createPageTurnWorkletState();
    playReleasedPageTurnWorklet(worklet, 1, false, {
      pressedEdgeX: 0.25,
      heldRollTilt: 0.7,
      speedScale: 1.8,
      turnProgress: 0.35,
      settlingProgress: 0,
    });

    expect(worklet.phase).toBe(PAGE_TURN_WORKLET_TURN);
    expect(worklet.pressedEdgeX).toBe(0.25);
    expect(worklet.driveStartX).toBe(0.25);
    expect(worklet.driveStartProgress).toBe(0.35);
    expect(worklet.driveStartRotation).toBe(0.7);
    expect(worklet.driveSpeedScale).toBe(1.8);
    expect(worklet.profile.at(-4)).toBeLessThan(0.25);
  });

  it("catches a handoff lane up to the advancing interactive sheet", () => {
    const interactive = createPageTurnWorkletState();
    beginPageTurnWorkletDrag(interactive, 1, 0.95, 0.5, 1, false);
    movePageTurnWorkletDrag(interactive, -0.12, 0.5, 0, 1.08);
    expect(endPageTurnWorkletDrag(interactive, 1.08)).toBe(1);

    const release = {
      pressedEdgeX: interactive.driveStartX,
      heldRollTilt: interactive.driveStartRotation,
      speedScale: interactive.driveSpeedScale,
      turnProgress: interactive.driveStartProgress,
      settlingProgress: interactive.settlingProgress,
      releasedAtSeconds: 1.08,
    };
    const handoffDelay = 0.09;
    advancePageTurnWorklet(interactive, handoffDelay);

    const lane = createPageTurnWorkletState();
    playReleasedPageTurnWorklet(lane, 1, false, release);
    const staleEdgeX = lane.profile.at(-4)!;
    const continuedEdgeX = interactive.profile.at(-4)!;
    expect(staleEdgeX).toBeGreaterThan(continuedEdgeX);

    catchUpPageTurnWorklet(lane, handoffDelay);
    expect(lane.profile).toEqual(interactive.profile);
  });

  it("settles an incoming previous page without an external unroll constant", () => {
    const worklet = createPageTurnWorkletState();
    playPageTurnWorklet(worklet, -1, true);

    for (let frame = 0; frame < 60; frame += 1) {
      advancePageTurnWorklet(worklet, 1 / 60);
    }

    expect(worklet.outcome).toBe(1);
  });
});

function expectProfilesToMatch(
  reference: NaturalPageTurnController,
  workletProfile: Float32Array,
): void {
  reference.getPoints().forEach((point, index) => {
    expect(workletProfile[index * 4]).toBeCloseTo(point.x, 4);
    expect(workletProfile[index * 4 + 1]).toBeCloseTo(point.z, 4);
  });
}
