import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_TURN_TUNING,
  NaturalPageTurnController,
  MIN_PRESSED_EDGE_X,
  SLOW_COMMIT_EDGE_X,
  automaticPageTurnSolverDurationSecondsForDirection,
} from "./index";

describe("natural page turn controller", () => {
  it("admits the extreme release point unless a lane requests a tighter cap", () => {
    const tuning = { ...DEFAULT_PAGE_TURN_TUNING, releaseX: 1 };
    const ordinary = new NaturalPageTurnController(tuning);
    const constrained = new NaturalPageTurnController(tuning, 0.8);

    ordinary.play();
    constrained.play();
    for (let frame = 0; frame < 3; frame += 1) {
      ordinary.advance(0.04);
      constrained.advance(0.04);
    }

    expect(ordinary.getMetrics().edgeX).toBeCloseTo(1, 8);
    expect(constrained.getMetrics().edgeX).toBeCloseTo(0.8, 8);
  });

  it("replays the reference automatic press and turn without shape shortcuts", () => {
    const controller = new NaturalPageTurnController();
    controller.play();

    advanceUntilSettled(controller);

    expect(controller.getPhase()).toBe("completed");
    expect(controller.getMetrics().edgeX).toBeCloseTo(-1, 5);
    expect(controller.getMetrics().maxLift).toBeCloseTo(0, 5);
  });

  it("matches the duration used for concurrency sizing", () => {
    const controller = new NaturalPageTurnController();
    controller.play();
    let elapsed = 0;
    while (controller.needsAnimationFrame() && elapsed < 2) {
      controller.advance(1 / 240);
      elapsed += 1 / 240;
    }

    expect(controller.getPhase()).toBe("completed");
    const estimatedDuration =
      automaticPageTurnSolverDurationSecondsForDirection(
        DEFAULT_PAGE_TURN_TUNING,
        1,
      );
    expect(elapsed).toBeGreaterThanOrEqual(estimatedDuration);
    expect(elapsed).toBeLessThan(estimatedDuration + 1 / 120);
  });

  it("keeps the dragged sheet attached to relative finger travel", () => {
    const controller = new NaturalPageTurnController();
    expect(controller.beginDrag(0.82, 0.7, 0)).toBe(true);
    controller.moveDrag(0.34, 0.7, 0.12);

    expect(controller.getPhase()).toBe("drag");
    expect(controller.getMetrics().edgeX).toBeCloseTo(0.52, 4);
    expect(controller.getMetrics().maxLift).toBeGreaterThan(0.35);
  });

  it("rotates the complete roll about the spine before committing", () => {
    const controller = new NaturalPageTurnController();
    expect(controller.beginDrag(0.82, 0.7, 0)).toBe(true);
    controller.moveDrag(0.82 - (1 - SLOW_COMMIT_EDGE_X), 0.7, 0.3);

    expect(controller.getMetrics().edgeX).toBeLessThan(MIN_PRESSED_EDGE_X);
    expect(controller.endDrag(0.3)).toBe("turn");
    advanceUntilSettled(controller);
    expect(controller.getPhase()).toBe("completed");
  });

  it("unrolls continuously across the second half of a two-page drag", () => {
    const controller = new NaturalPageTurnController();
    const startBookX = 0.9;
    const hingeBookX = startBookX - (1 - MIN_PRESSED_EDGE_X);
    expect(controller.beginDrag(startBookX, 0.7, 0)).toBe(true);

    controller.moveDrag(hingeBookX, 0.7, 0.2);
    const hingeMetrics = controller.getMetrics();
    controller.moveDrag(-0.55, 0.7, 0.4);
    const unfoldingMetrics = controller.getMetrics();
    controller.moveDrag(-1, 0.7, 0.6);
    const nearLandingMetrics = controller.getMetrics();
    const releaseProfile = controller
      .getPoints()
      .map((point) => ({ ...point }));

    expect(unfoldingMetrics.curvature).toBeLessThan(hingeMetrics.curvature);
    expect(unfoldingMetrics.edgeX).toBeLessThan(hingeMetrics.edgeX);
    expect(nearLandingMetrics.curvature).toBeLessThan(
      unfoldingMetrics.curvature,
    );
    expect(nearLandingMetrics.edgeX).toBeLessThan(-0.8);
    expect(controller.endDrag(0.6)).toBe("turn");
    expect(controller.getPoints()).toEqual(releaseProfile);
  });

  it("keeps the page profile continuous while crossing the spine", () => {
    const controller = new NaturalPageTurnController();
    const epsilon = 1e-6;
    expect(controller.beginDrag(1, 0.7, 0)).toBe(true);

    controller.moveDrag(MIN_PRESSED_EDGE_X + epsilon, 0.7, 0.2);
    const beforeHinge = controller.getPoints().map((point) => ({ ...point }));
    controller.moveDrag(MIN_PRESSED_EDGE_X - epsilon, 0.7, 0.21);
    const afterHinge = controller.getPoints();
    const maximumPointDisplacement = Math.max(
      ...afterHinge.map((point, index) =>
        Math.hypot(
          point.x - beforeHinge[index]!.x,
          point.z - beforeHinge[index]!.z,
        ),
      ),
    );

    expect(maximumPointDisplacement).toBeLessThan(1e-4);
  });

  it("keeps the visible free edge attached through the hinge and monotonic after it", () => {
    const controller = new NaturalPageTurnController({
      ...DEFAULT_PAGE_TURN_TUNING,
      curvatureRelaxation: 5,
    });
    expect(controller.beginDrag(1, 0.7, 0)).toBe(true);

    for (const [index, fingerX] of [0.3, 0.2, 0.14].entries()) {
      controller.moveDrag(fingerX, 0.7, 0.1 + index * 0.02);
      expect(controller.getMetrics().edgeX).toBeCloseTo(fingerX, 2);
    }

    let previousEdgeX = controller.getMetrics().edgeX;
    for (const [index, fingerX] of [
      0.08, 0, -0.1, -0.25, -0.5, -0.75, -1,
    ].entries()) {
      controller.moveDrag(fingerX, 0.7, 0.2 + index * 0.02);
      const edgeX = controller.getMetrics().edgeX;
      expect(edgeX).toBeLessThan(previousEdgeX);
      previousEdgeX = edgeX;
    }
    expect(previousEdgeX).toBeCloseTo(-1, 5);
  });

  it("does not pull the page edge backward on a post-hinge release", () => {
    const controller = new NaturalPageTurnController();
    const startBookX = 0.9;
    const postHingeFingerX = -0.12;
    const currentBookX = startBookX + postHingeFingerX - 1;
    expect(controller.beginDrag(startBookX, 0.7, 0)).toBe(true);
    controller.moveDrag(currentBookX, 0.7, 0.2);
    const draggedEdgeX = controller.getMetrics().edgeX;

    expect(controller.endDrag(0.2)).toBe("turn");
    controller.advance(1 / 240);

    expect(controller.getMetrics().edgeX).toBeLessThan(draggedEdgeX);
  });

  it("always rebounds a weak inboard grip", () => {
    const controller = new NaturalPageTurnController();
    expect(controller.beginDrag(0.2, 0.7, 0)).toBe(true);
    controller.moveDrag(-0.1, 0.7, 0.2);

    expect(controller.endDrag(0.2)).toBe("revert");
    advanceUntilSettled(controller);
    expect(controller.getPhase()).toBe("idle");
    expect(controller.getMetrics().edgeX).toBe(1);
  });

  it("keeps gesture releases out of the automatic press phase", () => {
    const untouched = new NaturalPageTurnController();
    untouched.beginDrag(0.95, 0.5, 0);
    expect(untouched.endDrag(0.05)).toBe("revert");
    expect(untouched.getPhase()).toBe("revert");

    const flick = new NaturalPageTurnController();
    flick.beginDrag(0.95, 0.5, 0);
    flick.moveDrag(0.2, 0.5, 0.01);
    expect(flick.endDrag(0.01)).toBe("turn");
    expect(flick.getPhase()).toBe("turn");
  });

  it("lands an incoming page from the raised profile without a press phase", () => {
    const controller = new NaturalPageTurnController();
    controller.playSettlingPage();

    // It joins at the top of its arc, still curled and standing over the spine.
    expect(controller.getPhase()).toBe("settle");
    expect(Math.abs(controller.getMetrics().edgeX)).toBeLessThan(0.1);
    expect(controller.getMetrics().maxLift).toBeGreaterThan(0.6);

    const firstPose = controller.getPoints().map((point) => ({ ...point }));
    controller.advance(1 / 60);
    expect(controller.getPhase()).toBe("settle");
    expect(controller.getIncomingPageProgress()).toBeGreaterThan(0);
    controller.getPoints().forEach((point, index) => {
      expect(point.x).toBeCloseTo(firstPose[index]!.x, 8);
      expect(point.z).toBeCloseTo(firstPose[index]!.z, 8);
    });

    for (let frame = 0; frame < 14; frame += 1) {
      controller.advance(1 / 60);
    }
    expect(controller.getMetrics().edgeX).toBeLessThan(0);

    advanceUntilSettled(controller);
    expect(controller.getPhase()).toBe("completed");
    expect(controller.getMetrics().edgeX).toBeCloseTo(-1, 5);
    expect(controller.getMetrics().maxLift).toBeCloseTo(0, 8);
  });

  it("continues a hand-driven incoming page from its current landing pose", () => {
    const controller = new NaturalPageTurnController();
    expect(controller.beginSettlingPageDrag(0)).toBe(true);
    expect(controller.moveSettlingPageDrag(0.45, 0.2)).toBe(true);
    const draggedEdge = controller.getMetrics().edgeX;

    expect(controller.getPhase()).toBe("drag");
    expect(draggedEdge).toBeLessThan(-0.2);
    expect(draggedEdge).toBeGreaterThan(-1);
    expect(controller.endSettlingPageDrag()).toBe("turn");
    expect(controller.getPhase()).toBe("settle");

    controller.advance(1 / 60);
    expect(controller.getMetrics().edgeX).toBeLessThan(draggedEdge);
    advanceUntilSettled(controller);
    expect(controller.getPhase()).toBe("completed");
    expect(controller.getMetrics().edgeX).toBeCloseTo(-1, 5);
  });

  it("uses release speed to accelerate an incoming-page landing", () => {
    const slow = new NaturalPageTurnController();
    const fast = new NaturalPageTurnController();
    const release = {
      pressedEdgeX: 0.69,
      heldRollTilt: 0,
      turnProgress: 0,
      settlingProgress: 0.3,
    };
    slow.playReleasedGesture({ ...release, speedScale: 0.5 }, true);
    fast.playReleasedGesture({ ...release, speedScale: 2 }, true);

    slow.advance(0.1);
    fast.advance(0.1);

    expect(fast.getMetrics().edgeX).toBeLessThan(slow.getMetrics().edgeX);
  });

  it("withdraws an incoming page when the hand reverses before release", () => {
    const controller = new NaturalPageTurnController();
    expect(controller.beginSettlingPageDrag(0)).toBe(true);
    controller.moveSettlingPageDrag(0.55, 0.2);
    controller.moveSettlingPageDrag(0.04, 0.5);

    expect(controller.getIncomingPageProgress()).toBeCloseTo(0.04, 8);
    expect(controller.endSettlingPageDrag(0.5)).toBe("revert");
    advanceUntilSettled(controller);

    expect(controller.getPhase()).toBe("idle");
    expect(controller.getIncomingPageProgress()).toBe(0);
  });
});

function advanceUntilSettled(controller: NaturalPageTurnController): void {
  for (
    let frame = 0;
    frame < 360 && controller.needsAnimationFrame();
    frame += 1
  ) {
    controller.advance(1 / 60);
  }
}
