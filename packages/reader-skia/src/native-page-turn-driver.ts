import {
  FULL_GESTURE_START_MIN_X,
  PAGE_TURN_WORKLET_DRAG,
  PAGE_TURN_WORKLET_IDLE,
  PAGE_TURN_WORKLET_NO_OUTCOME,
  SLOW_COMMIT_EDGE_X,
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
  hidePageTurnNativeSharedFrame,
  updatePageTurnNativeSharedFrame,
  usePageTurnNativeSharedFrame,
  type PageTurnNativeSharedFrame,
} from "./page-turn-native-shared-frame";
import { afterSkiaPaint } from "./skia-lifecycle";
import {
  bookXForGestureTravel,
  pageTurnDirectionFromTranslation,
} from "./page-turn-gesture-direction";
import {
  gestureTuningForCore,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";
import {
  beginNativePagerGestureOnUI,
  cancelNativePagerGestureOnUI,
  consumeNativePagerInputOnUI,
  endNativePagerGestureOnUI,
  updateNativePagerGestureOnUI,
} from "./native-pager-compositor";
import { useStableRNDispatcher } from "./use-stable-rn-dispatcher";

export interface NativePageTurnCommand {
  readonly id: string;
  readonly direction: 1 | -1;
  readonly interactive: boolean;
  readonly ready: boolean;
  readonly settlingIncomingPage: boolean;
}

export interface NativePageTurnBenchmarkCommand {
  readonly revision: number;
  readonly count: number;
  readonly intervalMs: number;
  readonly direction: 1 | -1;
}

interface NativePageTurnDriverOptions {
  readonly gesturesEnabled: boolean;
  /**
   * Gesture Handler recognizes the tap on the platform UI thread, then calls
   * the native compositor synchronously through its JSI HostObject. RN only
   * receives asynchronous reconciliation events.
   */
  readonly nativePagerTapInputEnabled?: boolean;
  /**
   * Gesture Handler remains the recognizer, while drag frames and release
   * settlement execute inside the C++ pager compositor.
   */
  readonly nativePagerGestureInputEnabled?: boolean;
  readonly nativePagerNativeId?: number;
  readonly width: number;
  readonly height: number;
  readonly physicalPageWidth: number;
  readonly spread: boolean;
  readonly canTurnBackward: boolean;
  readonly canTurnForward: boolean;
  readonly canStartInteractive: boolean;
  readonly tuning: GesturePageTurnTuning;
  readonly command?: NativePageTurnCommand;
  readonly benchmark?: NativePageTurnBenchmarkCommand;
  readonly onCenterTap: () => void;
  readonly onGestureBegin: (direction: 1 | -1) => void;
  readonly onGestureRelease: (release: PageGestureReleaseInput) => void;
  readonly onTapTurn: (direction: 1 | -1, requestedAtMs: number) => void;
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
  // 0 idle, 1 Worklet interactive, 2 deferred RN request, 3 C++ pager.
  mode: 0 | 1 | 2 | 3;
  direction: 1 | -1;
  startBookX: number;
  currentBookX: number;
  throwVelocity: number;
  throwAcceleration: number;
  lastThrowVelocity: number;
  lastTime: number;
  turnProgress: number;
}

interface NativePageTurnBenchmarkState {
  revision: number;
  remaining: number;
  nextAtMs: number;
  intervalMs: number;
  direction: 1 | -1;
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
 * Gesture Handler recognizes input on the UI thread. Warm single-page
 * gestures synchronously enter the C++ pager compositor, which owns the drag
 * clock, release settlement, geometry, and draw loop. The existing Worklet
 * state machine remains as a cold-texture and unsupported-layout fallback.
 */
export function useNativePageTurnDriver({
  gesturesEnabled,
  nativePagerTapInputEnabled = false,
  nativePagerGestureInputEnabled = false,
  nativePagerNativeId,
  width,
  height,
  physicalPageWidth,
  spread,
  canTurnBackward,
  canTurnForward,
  canStartInteractive,
  tuning,
  command,
  benchmark,
  onCenterTap,
  onGestureBegin,
  onGestureRelease,
  onTapTurn,
  onOutcome,
}: NativePageTurnDriverOptions): NativePageTurnDriver {
  const dispatchCenterTap = useStableRNDispatcher(onCenterTap);
  const dispatchGestureBegin = useStableRNDispatcher(onGestureBegin);
  const dispatchGestureRelease = useStableRNDispatcher(onGestureRelease);
  const dispatchTapTurn = useStableRNDispatcher(onTapTurn);
  const dispatchOutcome = useStableRNDispatcher(onOutcome);
  const onePhysicalPixel = 1 / Math.max(1, PixelRatio.get());
  const coreTuning = useMemo(() => gestureTuningForCore(tuning), [tuning]);
  const state = useSharedValue(createPageTurnWorkletState(coreTuning));
  const frame = usePageTurnNativeSharedFrame(width, height, spread);
  const gestureTarget = useSharedValue(createNativeGestureTarget());
  const gestureProbe = useSharedValue(createNativeGestureProbe());
  const gestureRequestHandled = useSharedValue(false);
  const benchmarkState = useSharedValue<NativePageTurnBenchmarkState>({
    revision: 0,
    remaining: 0,
    nextAtMs: 0,
    intervalMs: 100,
    direction: 1,
  });

  useEffect(() => {
    if (!__DEV__ || Platform.OS === "web" || benchmark === undefined) {
      return;
    }
    scheduleOnUI(
      (
        revision: number,
        count: number,
        intervalMs: number,
        direction: 1 | -1,
      ) => {
        "worklet";
        benchmarkState.value = {
          revision,
          remaining: count,
          nextAtMs: Date.now(),
          intervalMs,
          direction,
        };
      },
      benchmark.revision,
      benchmark.count,
      benchmark.intervalMs,
      benchmark.direction,
    );
  }, [benchmark, benchmarkState]);

  useFrameCallback(
    () => {
      "worklet";
      const now = Date.now();
      benchmarkState.modify((current) => {
        // A frame hitch may cross more than one 100 ms boundary. Preserve every
        // synthetic tap and its original UI-clock timestamp, but bound catch-up
        // work per frame so diagnostics cannot create an unbounded RN burst.
        let emitted = 0;
        while (
          current.remaining > 0 &&
          now >= current.nextAtMs &&
          emitted < 4
        ) {
          scheduleOnRN(dispatchTapTurn, current.direction, current.nextAtMs);
          current.remaining -= 1;
          current.nextAtMs += current.intervalMs;
          emitted += 1;
        }
        return current;
      }, true);
    },
    __DEV__ && Platform.OS !== "web",
  );

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
        scheduleOnRN(dispatchOutcome, current.outcome);
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
    let cancelled = false;
    afterSkiaPaint(() => {
      if (cancelled) {
        return;
      }
      scheduleOnUI(() => {
        "worklet";
        state.modify((current) => {
          if (current.phase === PAGE_TURN_WORKLET_IDLE) {
            hidePageTurnNativeSharedFrame(frame);
          }
          return current;
        }, true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [command, frame, state]);

  const gesture = useMemo(() => {
    const interactiveBlocked =
      !canStartInteractive || (command !== undefined && !command.interactive);
    const pan = Gesture.Pan()
      .enabled(gesturesEnabled)
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
            (!interactiveBlocked || nativePagerGestureInputEnabled)
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
            const initialProgress = clampUnit(
              Math.abs(event.translationX) /
                Math.max(1, physicalPageWidth * 0.72),
            );
            const nativeGestureStarted =
              nativePagerGestureInputEnabled &&
              nativePagerNativeId !== undefined &&
              !spread &&
              startBookX >= FULL_GESTURE_START_MIN_X
                ? beginNativePagerGestureOnUI(
                    nativePagerNativeId,
                    direction,
                    initialProgress,
                  )
                : false;
            if (nativeGestureStarted === true) {
              gestureProbe.modify((probe) => {
                probe.mode = 3;
                probe.direction = direction;
                probe.startBookX = startBookX;
                probe.currentBookX = startBookX;
                probe.throwVelocity = 0;
                probe.throwAcceleration = 0;
                probe.lastThrowVelocity = 0;
                probe.lastTime = workletTimeSeconds();
                probe.turnProgress = initialProgress;
                return probe;
              });
              return;
            }
            if (interactiveBlocked) {
              gestureProbe.modify((probe) => {
                probe.mode = 2;
                probe.direction = direction;
                probe.startBookX = startBookX;
                probe.currentBookX = startBookX;
                probe.throwVelocity = 0;
                probe.throwAcceleration = 0;
                probe.lastThrowVelocity = 0;
                probe.lastTime = workletTimeSeconds();
                probe.turnProgress = initialProgress;
                return probe;
              });
              return;
            }
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
            scheduleOnRN(dispatchGestureBegin, direction);
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
            const directionalTravel =
              probe.direction === 1 ? -event.translationX : event.translationX;
            probe.turnProgress = clampUnit(
              directionalTravel / Math.max(1, physicalPageWidth * 0.72),
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
          if (probeMode === 3) {
            const updatedProbe = gestureProbe.value;
            const nativeUpdated =
              nativePagerNativeId !== undefined
                ? updateNativePagerGestureOnUI(
                    nativePagerNativeId,
                    updatedProbe.turnProgress,
                  )
                : undefined;
            if (nativeUpdated !== true) {
              // The native view may have been reset while the finger was
              // down. Preserve the release as a deferred RN request instead
              // of dropping the user's turn.
              gestureProbe.modify((current) => {
                current.mode = 2;
                return current;
              });
            }
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
        if (probe.mode === 3) {
          const fingerX = Math.min(
            1,
            Math.max(-1, 1 + probe.currentBookX - probe.startBookX),
          );
          const nativeEnded =
            nativePagerNativeId !== undefined
              ? endNativePagerGestureOnUI(nativePagerNativeId, {
                  fingerX,
                  throwVelocity: probe.throwVelocity,
                  throwAcceleration: probe.throwAcceleration,
                  pageWeight: coreTuning.pageWeight,
                  commitThreshold: coreTuning.gestureCommitThreshold,
                  slowCommitEdgeX: SLOW_COMMIT_EDGE_X,
                  minimumSpeedScale: coreTuning.gestureMinimumSpeedScale,
                  maximumSpeedScale: coreTuning.gestureMaximumSpeedScale,
                  velocityGain: coreTuning.gestureVelocityGain,
                })
              : undefined;
          if (nativeEnded !== true) {
            scheduleOnRN(dispatchGestureRelease, {
              direction: probe.direction,
              interactive: false,
              startBookX: probe.startBookX,
              currentBookX: probe.currentBookX,
              throwVelocity: probe.throwVelocity,
              throwAcceleration: probe.throwAcceleration,
              turnProgress: probe.turnProgress,
              settlingIncomingPage: !spread && probe.direction === -1,
            });
          }
          gestureProbe.modify((current) => {
            current.mode = 0;
            return current;
          });
          return;
        }
        if (probe.mode === 2) {
          scheduleOnRN(dispatchGestureRelease, {
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
            scheduleOnRN(dispatchGestureRelease, {
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
        const probeMode = gestureProbe.value.mode;
        gestureProbe.modify((probe) => {
          probe.mode = 0;
          return probe;
        });
        if (!success && probeMode === 3 && nativePagerNativeId !== undefined) {
          cancelNativePagerGestureOnUI(nativePagerNativeId);
          return;
        }
        if (success || state.value.phase !== PAGE_TURN_WORKLET_DRAG) {
          return;
        }
        state.modify((current) => {
          cancelPageTurnWorkletDrag(current);
          updatePageTurnNativeSharedFrame(current, frame);
          if (!current.outcomeNotified) {
            current.outcomeNotified = true;
            scheduleOnRN(dispatchOutcome, current.outcome);
          }
          return current;
        }, true);
      });

    const tap = Gesture.Tap()
      // Native pager taps remain live while earlier curls are still on screen.
      // The pan path stays disabled until those turns settle, so a drag cannot
      // accidentally enter the RN scheduler during a native burst.
      .enabled(gesturesEnabled || nativePagerTapInputEnabled)
      .maxDistance(8)
      .onEnd((event, success) => {
        "worklet";
        if (!success) {
          return;
        }
        const requestedAtMs = Date.now();
        if (event.x <= width * 0.24 && canTurnBackward) {
          const nativeResult =
            nativePagerTapInputEnabled && nativePagerNativeId !== undefined
              ? consumeNativePagerInputOnUI(nativePagerNativeId, -1)
              : undefined;
          if (!nativePagerTapInputEnabled || nativeResult === undefined) {
            scheduleOnRN(dispatchTapTurn, -1, requestedAtMs);
          }
        } else if (event.x >= width * 0.76 && canTurnForward) {
          const nativeResult =
            nativePagerTapInputEnabled && nativePagerNativeId !== undefined
              ? consumeNativePagerInputOnUI(nativePagerNativeId, 1)
              : undefined;
          if (!nativePagerTapInputEnabled || nativeResult === undefined) {
            scheduleOnRN(dispatchTapTurn, 1, requestedAtMs);
          }
        } else if (
          event.x > width * 0.24 &&
          event.x < width * 0.76 &&
          state.value.phase === PAGE_TURN_WORKLET_IDLE
        ) {
          scheduleOnRN(dispatchCenterTap);
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
    gesturesEnabled,
    height,
    dispatchCenterTap,
    dispatchGestureBegin,
    dispatchGestureRelease,
    dispatchOutcome,
    dispatchTapTurn,
    onePhysicalPixel,
    nativePagerTapInputEnabled,
    nativePagerGestureInputEnabled,
    nativePagerNativeId,
    physicalPageWidth,
    spread,
    state,
    coreTuning,
    width,
  ]);

  return { frame, gesture };
}
