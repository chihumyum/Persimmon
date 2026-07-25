import {
  PAGE_TURN_WORKLET_DRAG,
  PAGE_TURN_WORKLET_IDLE,
  PAGE_TURN_WORKLET_NO_OUTCOME,
  advancePageTurnWorklet,
  beginPageTurnWorkletDrag,
  cancelPageTurnWorkletDrag,
  createPageTurnWorkletState,
  endPageTurnWorkletDrag,
  movePageTurnWorkletDrag,
  playPageTurnWorklet,
  setPageTurnWorkletTuning,
  type ReleasedPageTurnGesture,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";
import { Gesture } from "react-native-gesture-handler";
import { PixelRatio, Platform } from "react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { useEffect, useMemo } from "react";

import {
  updatePageTurnNativeSharedFrame,
  usePageTurnNativeSharedFrame,
  type PageTurnNativeSharedFrame,
} from "./page-turn-native-shared-frame";
import {
  bookXForGestureTravel,
  pageTurnDirectionFromTranslation,
} from "./page-turn-gesture-direction";
import {
  gestureTuningForCore,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";

export interface NativePageTurnCommand {
  readonly id: string;
  readonly direction: 1 | -1;
  readonly interactive: boolean;
  readonly ready: boolean;
  readonly settlingIncomingPage: boolean;
}

interface NativePageTurnDriverOptions {
  readonly width: number;
  readonly height: number;
  readonly physicalPageWidth: number;
  readonly spread: boolean;
  readonly canTurnBackward: boolean;
  readonly canTurnForward: boolean;
  readonly canStartInteractive: boolean;
  readonly tuning: GesturePageTurnTuning;
  readonly command?: NativePageTurnCommand;
  readonly onCenterTap: () => void;
  readonly onGestureBegin: (direction: 1 | -1) => void;
  readonly onGestureRelease: (release: PageGestureReleaseInput) => void;
  readonly onTapTurn: (direction: 1 | -1) => void;
  readonly onOutcome: (outcome: number) => void;
}

export interface PageGestureReleaseInput {
  readonly direction: 1 | -1;
  readonly interactive: boolean;
  readonly startBookX: number;
  readonly currentBookX: number;
  readonly throwVelocity: number;
  readonly throwAcceleration: number;
  readonly turnProgress: number;
  readonly settlingIncomingPage: boolean;
  readonly releasedGesture?: ReleasedPageTurnGesture;
}

export interface NativePageTurnDriver {
  readonly frame: PageTurnNativeSharedFrame;
  readonly gesture: ReturnType<typeof Gesture.Race>;
}

interface NativeGestureTarget {
  bookX: number;
  bookY: number;
  turnProgress: number;
  pendingRevision: number;
  appliedRevision: number;
}

interface NativeGestureProbe {
  mode: 0 | 1 | 2;
  direction: 1 | -1;
  startBookX: number;
  currentBookX: number;
  throwVelocity: number;
  throwAcceleration: number;
  lastThrowVelocity: number;
  lastTime: number;
  turnProgress: number;
}

function createNativeGestureTarget(): NativeGestureTarget {
  return {
    bookX: 1,
    bookY: 0.5,
    turnProgress: 0,
    pendingRevision: 0,
    appliedRevision: 0,
  };
}

function createNativeGestureProbe(): NativeGestureProbe {
  return {
    mode: 0,
    direction: 1,
    startBookX: 1,
    currentBookX: 1,
    throwVelocity: 0,
    throwAcceleration: 0,
    lastThrowVelocity: 0,
    lastTime: 0,
    turnProgress: 0,
  };
}

// Keep worklet dependencies above every worklet that captures them. The
// Worklets Babel transform serializes module-local helpers in source order;
// capturing a later transformed declaration can otherwise install
// `undefined` in the UI runtime even though normal JavaScript declarations
// would be hoisted.
function clampUnit(value: number): number {
  "worklet";
  return Math.min(1, Math.max(0, value));
}

function workletTimeSeconds(): number {
  "worklet";
  return Date.now() / 1000;
}

function materialXForTouch(
  localX: number,
  direction: 1 | -1,
  spread: boolean,
  physicalPageWidth: number,
): number {
  "worklet";
  if (spread) {
    return direction === 1
      ? clampUnit((localX - physicalPageWidth) / physicalPageWidth)
      : clampUnit((physicalPageWidth - localX) / physicalPageWidth);
  }
  return direction === 1
    ? clampUnit(localX / physicalPageWidth)
    : clampUnit(1 - localX / physicalPageWidth);
}

/**
 * Owns the complete native page-turn hot path.
 *
 * Gesture Handler recognizes input on the UI thread. The physical state
 * machine, profile integration, visible-face rasterization, and Skia shared
 * uniform buffer updates all run in the Reanimated UI runtime. The RN thread
 * receives only one begin event and one final outcome per turn.
 */
export function useNativePageTurnDriver({
  width,
  height,
  physicalPageWidth,
  spread,
  canTurnBackward,
  canTurnForward,
  canStartInteractive,
  tuning,
  command,
  onCenterTap,
  onGestureBegin,
  onGestureRelease,
  onTapTurn,
  onOutcome,
}: NativePageTurnDriverOptions): NativePageTurnDriver {
  const onePhysicalPixel = 1 / Math.max(1, PixelRatio.get());
  const coreTuning = useMemo(() => gestureTuningForCore(tuning), [tuning]);
  const state = useSharedValue(createPageTurnWorkletState(coreTuning));
  const frame = usePageTurnNativeSharedFrame(width, height, spread);
  const gestureTarget = useSharedValue(createNativeGestureTarget());
  const gestureProbe = useSharedValue(createNativeGestureProbe());
  const gestureRequestHandled = useSharedValue(false);

  useEffect(() => {
    scheduleOnUI((nextTuning: PageTurnTuning) => {
      "worklet";
      state.modify((current) => {
        setPageTurnWorkletTuning(current, nextTuning);
        return current;
      }, true);
    }, coreTuning);
  }, [coreTuning, state]);

  useFrameCallback(({ timeSincePreviousFrame }) => {
    "worklet";
    if (timeSincePreviousFrame === null) {
      return;
    }
    state.modify((current) => {
      if (current.phase === PAGE_TURN_WORKLET_IDLE) {
        return current;
      }
      if (current.phase === PAGE_TURN_WORKLET_DRAG) {
        let hasPendingTarget = false;
        let nextBookX = current.lastBookX;
        let nextBookY = current.lastBookY;
        let nextTurnProgress = current.settlingProgress;
        gestureTarget.modify((target) => {
          if (target.pendingRevision === target.appliedRevision) {
            return target;
          }
          hasPendingTarget = true;
          nextBookX = target.bookX;
          nextBookY = target.bookY;
          nextTurnProgress = target.turnProgress;
          target.appliedRevision = target.pendingRevision;
          return target;
        });
        if (!hasPendingTarget) {
          return current;
        }
        movePageTurnWorkletDrag(
          current,
          nextBookX,
          nextBookY,
          nextTurnProgress,
          workletTimeSeconds(),
        );
        updatePageTurnNativeSharedFrame(current, frame);
        return current;
      }
      if (!advancePageTurnWorklet(current, timeSincePreviousFrame / 1000)) {
        return current;
      }
      updatePageTurnNativeSharedFrame(current, frame);
      if (
        current.outcome !== PAGE_TURN_WORKLET_NO_OUTCOME &&
        !current.outcomeNotified
      ) {
        current.outcomeNotified = true;
        scheduleOnRN(onOutcome, current.outcome);
      }
      return current;
    }, true);
  }, Platform.OS !== "web");

  const programmaticTurnId =
    command?.ready && !command.interactive ? command.id : undefined;
  useEffect(() => {
    if (Platform.OS === "web" || !programmaticTurnId || !command) {
      return;
    }
    scheduleOnUI(
      (nextDirection: 1 | -1, settlingIncomingPage: boolean) => {
        "worklet";
        state.modify((current) => {
          playPageTurnWorklet(current, nextDirection, settlingIncomingPage);
          updatePageTurnNativeSharedFrame(current, frame);
          return current;
        }, true);
      },
      command.direction,
      command.settlingIncomingPage,
    );
  }, [command, frame, programmaticTurnId, state]);

  useEffect(() => {
    if (Platform.OS === "web" || command) {
      return;
    }
    scheduleOnUI(() => {
      "worklet";
      state.modify((current) => {
        if (current.phase !== PAGE_TURN_WORKLET_DRAG) {
          current.phase = PAGE_TURN_WORKLET_IDLE;
          current.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
          current.outcomeNotified = false;
        }
        return current;
      }, true);
    });
  }, [command, state]);

  const gesture = useMemo(() => {
    const interactiveBlocked =
      !canStartInteractive || (command !== undefined && !command.interactive);
    const pan = Gesture.Pan()
      // Gesture Handler measures in logical points. Converting one device
      // pixel keeps the initial paper response below a visible spatial step
      // on both Retina iOS screens and dense Android displays.
      .activeOffsetX([-onePhysicalPixel, onePhysicalPixel])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        "worklet";
        gestureRequestHandled.value = false;
        gestureProbe.modify((probe) => {
          probe.mode = 0;
          probe.throwVelocity = 0;
          probe.throwAcceleration = 0;
          probe.lastThrowVelocity = 0;
          probe.lastTime = workletTimeSeconds();
          probe.turnProgress = 0;
          return probe;
        });
      })
      .onUpdate((event) => {
        "worklet";
        const direction = pageTurnDirectionFromTranslation(event.translationX);
        if (!gestureRequestHandled.value && direction !== undefined) {
          const canTurn = direction === 1 ? canTurnForward : canTurnBackward;
          if (!canTurn) {
            gestureRequestHandled.value = true;
            return;
          }

          if (
            state.value.phase === PAGE_TURN_WORKLET_IDLE &&
            !interactiveBlocked
          ) {
            gestureRequestHandled.value = true;
            const startLocalX = event.x - event.translationX;
            const startLocalY = event.y - event.translationY;
            const startBookX = materialXForTouch(
              startLocalX,
              direction,
              spread,
              physicalPageWidth,
            );
            const startBookY = clampUnit(startLocalY / height);
            const settlingIncomingPage = !spread && direction === -1;
            gestureTarget.modify((target) => {
              target.bookX = startBookX;
              target.bookY = startBookY;
              target.turnProgress = 0;
              target.pendingRevision = 0;
              target.appliedRevision = 0;
              return target;
            });
            state.modify((current) => {
              beginPageTurnWorkletDrag(
                current,
                direction,
                startBookX,
                startBookY,
                workletTimeSeconds(),
                settlingIncomingPage,
              );
              updatePageTurnNativeSharedFrame(current, frame);
              return current;
            }, true);
            gestureProbe.modify((probe) => {
              probe.mode = 1;
              probe.direction = direction;
              probe.startBookX = startBookX;
              probe.currentBookX = startBookX;
              probe.lastTime = workletTimeSeconds();
              return probe;
            });
            scheduleOnRN(onGestureBegin, direction);
          } else {
            gestureRequestHandled.value = true;
            const startLocalX = event.x - event.translationX;
            const startBookX = materialXForTouch(
              startLocalX,
              direction,
              spread,
              physicalPageWidth,
            );
            gestureProbe.modify((probe) => {
              probe.mode = 2;
              probe.direction = direction;
              probe.startBookX = startBookX;
              probe.currentBookX = startBookX;
              probe.throwVelocity = 0;
              probe.throwAcceleration = 0;
              probe.lastThrowVelocity = 0;
              probe.lastTime = workletTimeSeconds();
              probe.turnProgress = 0;
              return probe;
            });
          }
        }
        const probeMode = gestureProbe.value.mode;
        if (probeMode !== 0) {
          const now = workletTimeSeconds();
          gestureProbe.modify((probe) => {
            probe.currentBookX = bookXForGestureTravel(
              probe.startBookX,
              event.translationX,
              probe.direction,
              physicalPageWidth,
            );
            probe.turnProgress = clampUnit(
              Math.abs(event.translationX) /
                Math.max(1, physicalPageWidth * 0.72),
            );
            const throwVelocity = Math.max(
              0,
              (probe.direction === 1 ? -event.velocityX : event.velocityX) /
                Math.max(1, physicalPageWidth),
            );
            const deltaTime = Math.max(0.001, now - probe.lastTime);
            const instantaneousAcceleration = Math.min(
              20,
              Math.max(
                -20,
                (throwVelocity - probe.lastThrowVelocity) / deltaTime,
              ),
            );
            const accelerationBlend = 1 - Math.exp(-deltaTime / 0.06);
            probe.throwAcceleration +=
              (instantaneousAcceleration - probe.throwAcceleration) *
              accelerationBlend;
            probe.throwVelocity = throwVelocity;
            probe.lastThrowVelocity = throwVelocity;
            probe.lastTime = now;
            return probe;
          });
          if (probeMode === 2) {
            return;
          }
        }
        if (state.value.phase !== PAGE_TURN_WORKLET_DRAG) {
          return;
        }
        const current = state.value;
        gestureTarget.modify((target) => {
          const bookX = bookXForGestureTravel(
            current.startBookX,
            event.translationX,
            current.direction,
            physicalPageWidth,
          );
          const travel =
            current.direction === 1 ? -event.translationX : event.translationX;
          const turnProgress = clampUnit(
            travel / ((spread ? physicalPageWidth : width) * 0.72),
          );
          target.bookX = bookX;
          target.bookY = clampUnit(event.y / height);
          target.turnProgress = turnProgress;
          target.pendingRevision += 1;
          return target;
        });
      })
      .onEnd(() => {
        "worklet";
        const releasedAtSeconds = workletTimeSeconds();
        const probe = gestureProbe.value;
        if (probe.mode === 2) {
          scheduleOnRN(onGestureRelease, {
            direction: probe.direction,
            interactive: false,
            startBookX: probe.startBookX,
            currentBookX: probe.currentBookX,
            throwVelocity: probe.throwVelocity,
            throwAcceleration: probe.throwAcceleration,
            turnProgress: probe.turnProgress,
            settlingIncomingPage: !spread && probe.direction === -1,
          });
          gestureProbe.modify((current) => {
            current.mode = 0;
            return current;
          });
          return;
        }
        const interactiveProbe = probe.mode === 1 ? probe : undefined;
        gestureProbe.modify((current) => {
          current.mode = 0;
          return current;
        });
        if (state.value.phase !== PAGE_TURN_WORKLET_DRAG) {
          return;
        }
        state.modify((current) => {
          const target = gestureTarget.value;
          if (target.pendingRevision !== target.appliedRevision) {
            movePageTurnWorkletDrag(
              current,
              target.bookX,
              target.bookY,
              target.turnProgress,
              workletTimeSeconds(),
            );
            gestureTarget.modify((mutableTarget) => {
              mutableTarget.appliedRevision = mutableTarget.pendingRevision;
              return mutableTarget;
            });
          }
          const settlingProgress = current.settlingProgress;
          const outcome = endPageTurnWorkletDrag(current, releasedAtSeconds);
          updatePageTurnNativeSharedFrame(current, frame);
          if (interactiveProbe && outcome > 0) {
            scheduleOnRN(onGestureRelease, {
              direction: interactiveProbe.direction,
              interactive: true,
              startBookX: interactiveProbe.startBookX,
              currentBookX: current.lastBookX,
              throwVelocity: interactiveProbe.throwVelocity,
              throwAcceleration: interactiveProbe.throwAcceleration,
              turnProgress: interactiveProbe.turnProgress,
              settlingIncomingPage:
                !spread && interactiveProbe.direction === -1,
              releasedGesture: {
                pressedEdgeX: current.driveStartX,
                heldRollTilt: current.driveStartRotation,
                speedScale: current.driveSpeedScale,
                turnProgress: current.driveStartProgress,
                settlingProgress,
                releasedAtSeconds,
              },
            });
          }
          return current;
        }, true);
      })
      .onFinalize((_event, success) => {
        "worklet";
        gestureProbe.modify((probe) => {
          probe.mode = 0;
          return probe;
        });
        if (success || state.value.phase !== PAGE_TURN_WORKLET_DRAG) {
          return;
        }
        state.modify((current) => {
          cancelPageTurnWorkletDrag(current);
          updatePageTurnNativeSharedFrame(current, frame);
          if (!current.outcomeNotified) {
            current.outcomeNotified = true;
            scheduleOnRN(onOutcome, current.outcome);
          }
          return current;
        }, true);
      });

    const tap = Gesture.Tap()
      .maxDistance(8)
      .onEnd((event, success) => {
        "worklet";
        if (!success) {
          return;
        }
        if (event.x <= width * 0.24 && canTurnBackward) {
          scheduleOnRN(onTapTurn, -1);
        } else if (event.x >= width * 0.76 && canTurnForward) {
          scheduleOnRN(onTapTurn, 1);
        } else if (state.value.phase === PAGE_TURN_WORKLET_IDLE) {
          scheduleOnRN(onCenterTap);
        }
      });
    return Gesture.Race(pan, tap);
  }, [
    canTurnBackward,
    canTurnForward,
    canStartInteractive,
    command,
    frame,
    gestureProbe,
    gestureRequestHandled,
    gestureTarget,
    height,
    onCenterTap,
    onGestureBegin,
    onGestureRelease,
    onOutcome,
    onTapTurn,
    onePhysicalPixel,
    physicalPageWidth,
    spread,
    state,
    width,
  ]);

  return { frame, gesture };
}
