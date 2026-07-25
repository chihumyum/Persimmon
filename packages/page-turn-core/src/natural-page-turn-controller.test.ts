import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_TURN_TUNING,
  NaturalPageTurnController,
  MIN_PRESSED_EDGE_X,
  SLOW_COMMIT_EDGE_X,
  automaticPageTurnSolverDurationSeconds,
} from "./index";

describe("natural page turn controller", () => {
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
    const estimatedDuration = automaticPageTurnSolverDurationSeconds(
      DEFAULT_PAGE_TURN_TUNING,
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

  it("always rebounds a weak inboard grip", () => {
    const controller = new NaturalPageTurnController();
    expect(controller.beginDrag(0.5, 0.7, 0)).toBe(true);
    controller.moveDrag(0.2, 0.7, 0.2);

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

    expect(controller.getPhase()).toBe("settle");
    expect(Math.abs(controller.getMetrics().edgeX)).toBeLessThan(0.1);
    expect(controller.getMetrics().maxLift).toBeGreaterThan(0.9);

    controller.advance(1 / 60);
    expect(controller.getPhase()).toBe("settle");
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
