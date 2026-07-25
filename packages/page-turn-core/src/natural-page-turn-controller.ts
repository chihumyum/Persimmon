import {
  MAX_PRESSED_ROLL_TILT,
  MIN_PRESSED_EDGE_X,
  RolledPageStrip,
  pressedRollCompleteness,
  type RolledPageMetrics,
  type RolledPagePoint,
} from "./rolled-page-strip";
import {
  DEFAULT_PAGE_TURN_TUNING,
  anchoredGestureFingerX,
  clampPageTurnTuning,
  gestureLiftRotationForFingerX,
  gestureTurnSpeedScale,
  pageGestureModeForStart,
  postHingeTurnProgressForFingerX,
  shouldCommitTurn,
  turnPropagationSpeed,
  weakGripPressedEdgeX,
  type PageGestureMode,
  type ReleasedPageTurnGesture,
  type PageTurnTuning,
} from "./page-turn-gesture";
import {
  revertDuration,
  revertEasedProgress,
  revertPressedEdgeX,
} from "./revert-kinematics";
import {
  AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS,
  INCOMING_PAGE_SETTLE_DURATION_SECONDS,
  PAGE_TURN_PROPAGATION_SPEED_SCALE,
} from "./page-turn-timing";

export type NaturalPageTurnPhase =
  | "idle"
  | "drag"
  | "press"
  | "turn"
  | "settle"
  | "revert"
  | "completed";

export type NaturalPageTurnRelease = "ignored" | "revert" | "turn";

interface NaturalPageTurnDrag {
  mode: PageGestureMode;
  startBookX: number;
  lastBookX: number;
  lastBookY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  throwAcceleration: number;
  gestureFingerX: number;
  pressedEdgeX: number;
  heldRollTilt: number;
  turnProgress: number;
}

interface NaturalPageTurnDrive {
  phase: "press" | "turn" | "settle" | "revert";
  elapsed: number;
  startX: number;
  tuning: PageTurnTuning;
  speedScale: number;
  startProgress: number;
  startRotation: number;
  revertPressedStartX: number;
  revertCompleteness: number;
  revertStartRotation: number;
}

/**
 * Where an incoming page joins a turn: the top of its arc, just as it crosses
 * the spine and before it starts laying itself down on the page below.
 */
const SETTLING_PAGE_START_PROGRESS = 0.3;
const GESTURE_VELOCITY_TIME_CONSTANT = 0.045;
const GESTURE_ACCELERATION_TIME_CONSTANT = 0.06;
const MAX_TRACKED_GESTURE_VELOCITY = 6;
const MAX_TRACKED_GESTURE_ACCELERATION = 20;

/**
 * Platform-neutral translation of the reference demo's ScrubTurnController.
 *
 * It intentionally owns only normalized page geometry and gesture kinematics.
 * DOM, React Native, Skia, and animation-frame scheduling stay outside so every
 * renderer consumes the exact same physical state machine.
 */
export class NaturalPageTurnController {
  private readonly sheet = new RolledPageStrip();
  private drag: NaturalPageTurnDrag | null = null;
  private settlingDrag: { lastTime: number; progress: number } | null = null;
  private drive: NaturalPageTurnDrive | null = null;
  private completed = false;
  private tuning: PageTurnTuning;

  constructor(tuning: PageTurnTuning = DEFAULT_PAGE_TURN_TUNING) {
    this.tuning = clampPageTurnTuning(tuning);
  }

  setTuning(tuning: PageTurnTuning): void {
    this.tuning = clampPageTurnTuning(tuning);
    if (this.drive || this.settlingDrag || this.completed) {
      this.reset();
    }
  }

  play(): void {
    this.reset();
    this.drive = {
      phase: "press",
      elapsed: 0,
      startX: this.tuning.releaseX,
      tuning: { ...this.tuning },
      speedScale: 1,
      startProgress: 0,
      startRotation: 0,
      revertPressedStartX: this.tuning.releaseX,
      revertCompleteness: 0,
      revertStartRotation: 0,
    };
  }

  /**
   * Plays only the landing half of an incoming page.
   *
   * In a single-page viewport a backward turn represents the left page of a
   * virtual spread landing on the current (right) page. Starting from the
   * raised release profile and relaxing it to flat avoids replaying the
   * outgoing page's press-and-lift phase in reverse.
   */
  playSettlingPage(): void {
    this.reset();
    this.sheet.setTurnProgress(
      SETTLING_PAGE_START_PROGRESS,
      this.tuning.releaseX,
      0,
      0,
      this.tuning.curvatureRelaxation,
    );
    this.beginSettlingDrive(SETTLING_PAGE_START_PROGRESS);
  }

  /**
   * Continues from a gesture release without entering the automatic press
   * phase. Tap playback and gesture playback deliberately have separate entry
   * points so a short, fast flick can never degrade into a click animation.
   */
  playReleasedGesture(
    release: ReleasedPageTurnGesture,
    settlingIncomingPage = false,
  ): void {
    this.reset();
    if (settlingIncomingPage) {
      const startProgress = landingTurnProgress(release.settlingProgress);
      this.sheet.setTurnProgress(
        startProgress,
        this.tuning.releaseX,
        0,
        0,
        this.tuning.curvatureRelaxation,
      );
      this.beginSettlingDrive(startProgress);
      return;
    }
    const startX = clamp(release.pressedEdgeX, MIN_PRESSED_EDGE_X, 1);
    const startRotation = clamp(release.heldRollTilt, 0, MAX_PRESSED_ROLL_TILT);
    const startProgress = clamp(release.turnProgress, 0, 1);
    this.sheet.setTurnProgress(
      startProgress,
      startX,
      0,
      startRotation,
      this.tuning.curvatureRelaxation,
    );
    this.beginTurn(
      startX,
      startProgress,
      clamp(release.speedScale, 0.5, 3),
      startRotation,
    );
  }

  /**
   * Starts a hand-driven incoming-page landing at the virtual spine.
   *
   * The renderer reflects this right-to-left profile across x=0, producing
   * the second half of a left-page-to-right-page turn.
   */
  beginSettlingPageDrag(time: number): boolean {
    if (this.drive || this.drag || this.settlingDrag) {
      return false;
    }
    if (this.completed) {
      this.reset();
    }
    this.sheet.setTurnProgress(
      SETTLING_PAGE_START_PROGRESS,
      this.tuning.releaseX,
      0,
      0,
      this.tuning.curvatureRelaxation,
    );
    this.settlingDrag = {
      lastTime: safeTime(time),
      progress: 0,
    };
    return true;
  }

  moveSettlingPageDrag(progress: number, time: number): boolean {
    const drag = this.settlingDrag;
    if (!drag) {
      return false;
    }
    const currentTime = safeTime(time);
    const deltaTime = Math.max(0, currentTime - drag.lastTime);
    drag.lastTime = currentTime;
    drag.progress = clamp(progress, 0, 1);
    this.sheet.setTurnProgress(
      landingTurnProgress(drag.progress),
      this.tuning.releaseX,
      deltaTime,
      0,
      this.tuning.curvatureRelaxation,
    );
    return true;
  }

  endSettlingPageDrag(): NaturalPageTurnRelease {
    const drag = this.settlingDrag;
    if (!drag) {
      return "ignored";
    }
    this.settlingDrag = null;
    this.beginSettlingDrive(landingTurnProgress(drag.progress));
    return "turn";
  }

  reset(): void {
    this.drive = null;
    this.drag = null;
    this.settlingDrag = null;
    this.completed = false;
    this.sheet.reset();
  }

  beginDrag(startBookX: number, startBookY: number, time: number): boolean {
    if (this.drive || this.settlingDrag) {
      return false;
    }
    if (this.completed) {
      this.reset();
    }
    const mode = pageGestureModeForStart(startBookX);
    if (!mode) {
      return false;
    }
    this.drag = {
      mode,
      startBookX,
      lastBookX: startBookX,
      lastBookY: startBookY,
      lastTime: safeTime(time),
      velocityX: 0,
      velocityY: 0,
      throwAcceleration: 0,
      gestureFingerX: 1,
      pressedEdgeX: 1,
      heldRollTilt: 0,
      turnProgress: 0,
    };
    this.applyDraggedEdge(startBookX, 0, this.drag);
    return true;
  }

  moveDrag(bookX: number, bookY: number, time: number): boolean {
    const drag = this.drag;
    if (!drag) {
      return false;
    }
    const currentTime = safeTime(time);
    const deltaTime = Math.max(0.001, currentTime - drag.lastTime);
    const deltaX = bookX - drag.lastBookX;
    const deltaY = bookY - drag.lastBookY;
    const previousThrowVelocity = gestureThrowVelocity(drag);
    const instantaneousVelocityX = clamp(
      deltaX / deltaTime,
      -MAX_TRACKED_GESTURE_VELOCITY,
      MAX_TRACKED_GESTURE_VELOCITY,
    );
    const instantaneousVelocityY = clamp(
      deltaY / deltaTime,
      -MAX_TRACKED_GESTURE_VELOCITY,
      MAX_TRACKED_GESTURE_VELOCITY,
    );
    const velocityBlend =
      1 - Math.exp(-deltaTime / GESTURE_VELOCITY_TIME_CONSTANT);
    drag.velocityX += (instantaneousVelocityX - drag.velocityX) * velocityBlend;
    drag.velocityY += (instantaneousVelocityY - drag.velocityY) * velocityBlend;
    const throwVelocity = gestureThrowVelocity(drag);
    const instantaneousAcceleration = clamp(
      (throwVelocity - previousThrowVelocity) / deltaTime,
      -MAX_TRACKED_GESTURE_ACCELERATION,
      MAX_TRACKED_GESTURE_ACCELERATION,
    );
    const accelerationBlend =
      1 - Math.exp(-deltaTime / GESTURE_ACCELERATION_TIME_CONSTANT);
    drag.throwAcceleration +=
      (instantaneousAcceleration - drag.throwAcceleration) * accelerationBlend;
    drag.lastBookX = bookX;
    drag.lastBookY = bookY;
    drag.lastTime = currentTime;
    this.applyDraggedEdge(bookX, deltaTime, drag);
    return true;
  }

  endDrag(time: number): NaturalPageTurnRelease {
    const drag = this.drag;
    if (!drag) {
      return "ignored";
    }
    this.drag = null;
    const currentTime = safeTime(time);
    const idleTime = Math.max(0, currentTime - drag.lastTime);
    const idleDecay = Math.exp(-idleTime / this.tuning.gestureIdleDecaySeconds);
    const throwVelocity = gestureThrowVelocity(drag) * idleDecay;
    const throwAcceleration = drag.throwAcceleration * idleDecay;
    const speedScale = gestureTurnSpeedScale(throwVelocity, this.tuning);
    if (drag.mode === "weak") {
      this.beginRevert(drag.pressedEdgeX, 0);
      return "revert";
    }

    const commitInput = {
      fingerX: drag.gestureFingerX,
      throwVelocity,
      throwAcceleration,
      pageWeight: this.tuning.pageWeight,
    };
    if (shouldCommitTurn(commitInput, this.tuning)) {
      this.beginTurn(
        drag.pressedEdgeX,
        drag.turnProgress,
        speedScale,
        drag.heldRollTilt,
      );
      return "turn";
    }
    this.beginRevert(drag.pressedEdgeX, drag.heldRollTilt);
    return "revert";
  }

  cancelDrag(): void {
    this.reset();
  }

  advance(deltaTime: number): boolean {
    const drive = this.drive;
    const safeDelta = clamp(deltaTime, 0, 0.05);
    if (!drive || safeDelta <= 0) {
      return false;
    }
    drive.elapsed += safeDelta;

    if (drive.phase === "press") {
      const progress = Math.min(
        1,
        drive.elapsed / AUTOMATIC_PAGE_TURN_PRESS_DURATION_SECONDS,
      );
      const edgeX = 1 + (drive.tuning.releaseX - 1) * progress;
      this.sheet.setPressedEdge(edgeX, safeDelta);
      if (progress >= 1) {
        drive.phase = "turn";
        drive.elapsed = 0;
        drive.startX = drive.tuning.releaseX;
        drive.startProgress = 0;
      }
      return true;
    }

    if (drive.phase === "revert") {
      this.updateRevertDrive(drive, safeDelta);
      return true;
    }
    if (drive.phase === "settle") {
      this.updateSettlingDrive(drive, safeDelta);
      return true;
    }

    const duration = remainingTurnDuration(drive);
    const segmentProgress = Math.min(1, drive.elapsed / duration);
    const progress =
      drive.startProgress + (1 - drive.startProgress) * segmentProgress;
    this.sheet.setTurnProgress(
      progress,
      drive.startX,
      safeDelta,
      drive.startRotation,
      drive.tuning.curvatureRelaxation,
    );
    if (progress >= 1) {
      this.drive = null;
      this.completed = true;
      this.sheet.stop();
    }
    return true;
  }

  getPhase(): NaturalPageTurnPhase {
    if (this.completed) {
      return "completed";
    }
    if (this.drag) {
      return "drag";
    }
    if (this.settlingDrag) {
      return "drag";
    }
    return this.drive?.phase ?? "idle";
  }

  needsAnimationFrame(): boolean {
    return this.drive !== null;
  }

  getPoints(): readonly RolledPagePoint[] {
    return this.sheet.getPoints();
  }

  getMetrics(): RolledPageMetrics {
    return this.sheet.getMetrics();
  }

  private beginTurn(
    startX: number,
    startProgress: number,
    speedScale: number,
    startRotation = 0,
  ): void {
    this.completed = false;
    this.drive = {
      phase: "turn",
      elapsed: 0,
      startX,
      tuning: { ...this.tuning },
      speedScale,
      startProgress,
      startRotation,
      revertPressedStartX: startX,
      revertCompleteness: 0,
      revertStartRotation: 0,
    };
  }

  private beginRevert(pressedEdgeX: number, startRotation: number): void {
    const safePressedEdgeX = clamp(pressedEdgeX, MIN_PRESSED_EDGE_X, 1);
    this.completed = false;
    this.drive = {
      phase: "revert",
      elapsed: 0,
      startX: safePressedEdgeX,
      tuning: { ...this.tuning },
      speedScale: 1,
      startProgress: 0,
      startRotation: 0,
      revertPressedStartX: safePressedEdgeX,
      revertCompleteness: pressedRollCompleteness(safePressedEdgeX),
      revertStartRotation: startRotation,
    };
  }

  private beginSettlingDrive(startProgress: number): void {
    this.completed = false;
    this.drive = {
      phase: "settle",
      elapsed: 0,
      startX: this.tuning.releaseX,
      tuning: { ...this.tuning },
      speedScale: 1,
      startProgress: clamp(startProgress, SETTLING_PAGE_START_PROGRESS, 1),
      startRotation: 0,
      revertPressedStartX: this.tuning.releaseX,
      revertCompleteness: 0,
      revertStartRotation: 0,
    };
  }

  private updateSettlingDrive(
    drive: NaturalPageTurnDrive,
    deltaTime: number,
  ): void {
    const remainingRatio =
      (1 - drive.startProgress) / (1 - SETTLING_PAGE_START_PROGRESS);
    const duration = Math.max(
      1 / 60,
      INCOMING_PAGE_SETTLE_DURATION_SECONDS * remainingRatio,
    );
    const easedProgress = settleEasedProgress(drive.elapsed, duration);
    const progress =
      drive.startProgress + (1 - drive.startProgress) * easedProgress;
    this.sheet.setTurnProgress(
      progress,
      drive.startX,
      deltaTime,
      0,
      drive.tuning.curvatureRelaxation,
    );
    if (drive.elapsed >= duration) {
      this.drive = null;
      this.sheet.setTurnProgress(
        1,
        drive.startX,
        deltaTime,
        0,
        drive.tuning.curvatureRelaxation,
      );
      this.sheet.stop();
      this.completed = true;
    }
  }

  private updateRevertDrive(
    drive: NaturalPageTurnDrive,
    deltaTime: number,
  ): void {
    const duration = revertDuration(
      drive.revertPressedStartX,
      drive.revertCompleteness,
    );
    const easedProgress = revertEasedProgress(drive.elapsed, duration);
    const edgeX = revertPressedEdgeX(
      drive.revertPressedStartX,
      drive.elapsed,
      drive.revertCompleteness,
    );
    const rotation = drive.revertStartRotation * (1 - easedProgress);
    this.sheet.setPressedState(edgeX, rotation, deltaTime);
    if (drive.elapsed >= duration) {
      this.drive = null;
      this.sheet.reset();
      this.sheet.stop();
      this.completed = false;
    }
  }

  private applyDraggedEdge(
    bookX: number,
    deltaTime: number,
    drag: NaturalPageTurnDrag,
  ): void {
    if (drag.mode === "weak") {
      drag.gestureFingerX = 1;
      drag.pressedEdgeX = weakGripPressedEdgeX(drag.startBookX, bookX);
      drag.heldRollTilt = 0;
      drag.turnProgress = 0;
      this.sheet.setPressedState(drag.pressedEdgeX, 0, deltaTime);
      return;
    }

    drag.gestureFingerX = anchoredGestureFingerX(drag.startBookX, bookX);
    drag.pressedEdgeX = Math.max(MIN_PRESSED_EDGE_X, drag.gestureFingerX);
    drag.heldRollTilt = gestureLiftRotationForFingerX(drag.gestureFingerX);
    drag.turnProgress = postHingeTurnProgressForFingerX(
      drag.gestureFingerX,
      drag.startBookX,
    );
    if (drag.turnProgress > 0) {
      this.sheet.setTurnProgress(
        drag.turnProgress,
        MIN_PRESSED_EDGE_X,
        deltaTime,
        MAX_PRESSED_ROLL_TILT,
        this.tuning.curvatureRelaxation,
      );
      return;
    }
    this.sheet.setPressedState(drag.pressedEdgeX, drag.heldRollTilt, deltaTime);
  }
}

function fullTurnDuration(drive: NaturalPageTurnDrive): number {
  const propagationSpeed =
    turnPropagationSpeed(drive.tuning) *
    PAGE_TURN_PROPAGATION_SPEED_SCALE *
    drive.speedScale;
  const remainingRotationRatio = (Math.PI - drive.startRotation) / Math.PI;
  return (
    ((drive.startX + 1) * remainingRotationRatio) /
    Math.max(0.1, propagationSpeed)
  );
}

function remainingTurnDuration(drive: NaturalPageTurnDrive): number {
  return Math.max(1e-6, (1 - drive.startProgress) * fullTurnDuration(drive));
}

function gestureThrowVelocity(drag: NaturalPageTurnDrag): number {
  const leftwardVelocity = Math.max(0, -drag.velocityX);
  const upwardVelocity = Math.max(0, -drag.velocityY);
  return Math.hypot(leftwardVelocity, upwardVelocity * 0.75);
}

function safeTime(time: number): number {
  return Number.isFinite(time) ? time : 0;
}

function settleEasedProgress(elapsed: number, duration: number): number {
  const progress = clamp(elapsed / duration, 0, 1);
  return 1 - (1 - progress) ** 2;
}

function landingTurnProgress(progress: number): number {
  return (
    SETTLING_PAGE_START_PROGRESS +
    (1 - SETTLING_PAGE_START_PROGRESS) * clamp(progress, 0, 1)
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
