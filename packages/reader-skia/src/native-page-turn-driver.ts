import {
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
import { PixelRatio } from "react-native";
import {
  startMapper,
  stopMapper,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { useCallback, useEffect, useMemo } from "react";

import {
  hidePageTurnNativeSharedFrame,
  updatePageTurnNativeSharedFrame,
  usePageTurnNativeSharedFrame,
  type PageTurnNativeSharedFrame,
} from "./page-turn-native-shared-frame";
import { afterSkiaPaint } from "./skia-lifecycle";
import {
  bookXForGestureTravel,
  normalPageTurnDirectionForTouch,
  pageTurnGestureReleaseSample,
  pageTurnStartBookXForTouch,
  pageTurnTerminalDirection,
} from "./page-turn-gesture-direction";
import {
  gestureTuningForCore,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";
import {
  reverseGestureTuningForCore,
  type ReverseGesturePageTurnTuning,
} from "./reverse-gesture-page-turn-tuning";
import {
  beginNativePagerGestureOnUI,
  cancelNativePagerGestureOnUI,
  consumeNativePagerInputOnUI,
  endNativePagerGestureOnUI,
  tryConsumeNativePagerInputOnUI,
  updateNativePagerGestureOnUI,
} from "./native-pager-compositor";
import {
  nativePagerTapNeedsRNFallback,
  resolvePageTurnRecognizerDistances,
} from "./native-pager-input";
import { pageTurnTuningForLayoutDirection } from "./page-turn-direction";
import {
  PAGE_RIFFLE_ARMED,
  PAGE_RIFFLE_INWARD,
  PAGE_RIFFLE_INTERVAL_MS,
  nextPageRiffleTickAt,
  pageRiffleCandidateForTouch,
  pageRiffleGestureDisposition,
  pageRiffleHoldReady,
} from "./page-turn-riffle";
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
  readonly rapidPageTurnEnabled?: boolean;
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
  readonly reverseTuning: ReverseGesturePageTurnTuning;
  readonly command?: NativePageTurnCommand;
  readonly benchmark?: NativePageTurnBenchmarkCommand;
  readonly onCenterTap: () => void;
  readonly onGestureBegin: (direction: 1 | -1) => void;
  readonly onGestureRelease: (release: PageGestureReleaseInput) => void;
  readonly onTapTurn: (direction: 1 | -1, requestedAtMs: number) => void;
  readonly onRapidTurn: (direction: 1 | -1, requestedAtMs: number) => void;
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
  // 0 idle, 1 Worklet, 2 deferred RN, 3 C++ pager, 4 riffle dwell, 5 active riffle.
  mode: 0 | 1 | 2 | 3 | 4 | 5;
  touchStartLocalX: number;
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

interface NativePageRiffleState {
  active: boolean;
  armedAtMs: number;
  nextAtMs: number;
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
    touchStartLocalX: 0,
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

/**
 * Owns the complete native page-turn hot path.
 *
 * Gesture Handler recognizes input on the UI thread. Warm gestures
 * synchronously enter the C++ pager compositor, which owns the drag clock,
 * release settlement, geometry, and draw loop. The existing Worklet state
 * machine remains as the cold-texture fallback.
 */
export function useNativePageTurnDriver({
  gesturesEnabled,
  rapidPageTurnEnabled = true,
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
  reverseTuning,
  command,
  benchmark,
  onCenterTap,
  onGestureBegin,
  onGestureRelease,
  onTapTurn,
  onRapidTurn,
  onOutcome,
}: NativePageTurnDriverOptions): NativePageTurnDriver {
  const dispatchCenterTap = useStableRNDispatcher(onCenterTap);
  const dispatchGestureBegin = useStableRNDispatcher(onGestureBegin);
  const dispatchGestureRelease = useStableRNDispatcher(onGestureRelease);
  const dispatchTapTurn = useStableRNDispatcher(onTapTurn);
  const dispatchRapidTurn = useStableRNDispatcher(onRapidTurn);
  const dispatchOutcome = useStableRNDispatcher(onOutcome);
  const onePhysicalPixel = 1 / Math.max(1, PixelRatio.get());
  const { tapMaxDistance, panActivationDistance } =
    resolvePageTurnRecognizerDistances(onePhysicalPixel);
  const forwardCoreTuning = useMemo(
    () => gestureTuningForCore(tuning),
    [tuning],
  );
  const reverseCoreTuning = useMemo(
    () =>
      pageTurnTuningForLayoutDirection(
        gestureTuningForCore(tuning),
        reverseGestureTuningForCore(reverseTuning),
        -1,
        spread,
      ),
    [reverseTuning, spread, tuning],
  );
  const state = useSharedValue(createPageTurnWorkletState(forwardCoreTuning));
  const frame = usePageTurnNativeSharedFrame(width, height, spread);
  const gestureTarget = useSharedValue(createNativeGestureTarget());
  const gestureProbe = useSharedValue(createNativeGestureProbe());
  const gestureRequestHandled = useSharedValue(false);
  const riffleState = useSharedValue<NativePageRiffleState>({
    active: false,
    armedAtMs: 0,
    nextAtMs: 0,
    direction: 1,
  });
  const benchmarkState = useSharedValue<NativePageTurnBenchmarkState>({
    revision: 0,
    remaining: 0,
    nextAtMs: 0,
    intervalMs: 100,
    direction: 1,
  });

  useEffect(() => {
    // Reanimated's native gesture handler polls for `global.__mapperRun` when
    // no mapper registry exists yet. Every gesture event starts another poll,
    // so rapid tapping can accumulate thousands of permanent UI-runtime frame
    // callbacks. A persistent no-op mapper initializes the registry before the
    // first page-turn gesture while keeping the native gesture hot path intact.
    const mapperId = startMapper(() => {
      "worklet";
    });
    return () => {
      stopMapper(mapperId);
    };
  }, []);

  useEffect(() => {
    if (!__DEV__ || benchmark === undefined) {
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

  const advanceBenchmarkFrame = useCallback(() => {
    "worklet";
    const now = Date.now();
    benchmarkState.modify((current) => {
      // A frame hitch may cross more than one cadence boundary. Preserve every
      // synthetic tap and its original UI-clock timestamp, but bound catch-up
      // work per frame so diagnostics cannot create an unbounded RN burst.
      let emitted = 0;
      while (current.remaining > 0 && now >= current.nextAtMs && emitted < 4) {
        scheduleOnRN(dispatchTapTurn, current.direction, current.nextAtMs);
        current.remaining -= 1;
        current.nextAtMs += current.intervalMs;
        emitted += 1;
      }
      return current;
    }, true);
  }, [benchmarkState, dispatchTapTurn]);
  const benchmarkFrameCallback = useFrameCallback(advanceBenchmarkFrame, false);

  useEffect(() => {
    const active = __DEV__ && benchmark !== undefined;
    benchmarkFrameCallback.setActive(active);
    return () => {
      benchmarkFrameCallback.setActive(false);
    };
  }, [benchmark, benchmarkFrameCallback]);

  const advanceRiffleFrame = useCallback(() => {
    "worklet";
    const now = Date.now();
    let emitDirection: 1 | -1 | 0 = 0;
    let activateRiffle = false;
    riffleState.modify((current) => {
      if (!current.active) {
        if (
          current.armedAtMs <= 0 ||
          !pageRiffleHoldReady(current.armedAtMs, now)
        ) {
          return current;
        }
        current.active = true;
        current.armedAtMs = 0;
        activateRiffle = true;
      } else if (now < current.nextAtMs) {
        return current;
      }
      const canTurn =
        current.direction === 1 ? canTurnForward : canTurnBackward;
      if (!canTurn) {
        current.active = false;
        current.armedAtMs = 0;
        current.nextAtMs = 0;
        return current;
      }
      emitDirection = current.direction;
      current.nextAtMs = nextPageRiffleTickAt(now, PAGE_RIFFLE_INTERVAL_MS);
      return current;
    }, true);
    if (activateRiffle) {
      gestureRequestHandled.value = true;
      gestureProbe.modify((probe) => {
        probe.mode = 5;
        probe.lastTime = workletTimeSeconds();
        return probe;
      });
    }
    if (emitDirection === 0) {
      return;
    }
    const nativeResult =
      nativePagerGestureInputEnabled && nativePagerNativeId !== undefined
        ? tryConsumeNativePagerInputOnUI(nativePagerNativeId, emitDirection)
        : undefined;
    if (nativeResult === undefined) {
      scheduleOnRN(dispatchRapidTurn, emitDirection, now);
    }
  }, [
    canTurnBackward,
    canTurnForward,
    dispatchRapidTurn,
    gestureProbe,
    gestureRequestHandled,
    nativePagerGestureInputEnabled,
    nativePagerNativeId,
    riffleState,
  ]);
  const riffleFrameCallback = useFrameCallback(advanceRiffleFrame, false);
  const setRiffleClockActive = useCallback(
    (active: boolean) => {
      riffleFrameCallback.setActive(active);
    },
    [riffleFrameCallback],
  );
  const dispatchRiffleClockActive = useStableRNDispatcher(setRiffleClockActive);

  useEffect(
    () => () => {
      riffleFrameCallback.setActive(false);
    },
    [riffleFrameCallback],
  );

  useEffect(() => {
    scheduleOnUI(
      (forward: PageTurnTuning, backward: PageTurnTuning) => {
        "worklet";
        state.modify((current) => {
          setPageTurnWorkletTuning(
            current,
            current.direction === -1 ? backward : forward,
          );
          return current;
        }, true);
      },
      forwardCoreTuning,
      reverseCoreTuning,
    );
  }, [forwardCoreTuning, reverseCoreTuning, state]);

  const advanceDriverFrame = useCallback(
    ({ timeSincePreviousFrame }: FrameInfo) => {
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
    },
    [dispatchOutcome, frame, gestureTarget, state],
  );
  const driverFrameCallback = useFrameCallback(advanceDriverFrame, false);

  useEffect(() => {
    // Warm gestures and taps run entirely in the C++ pager. Keep the Worklet
    // fallback clock asleep until a cold gesture can actually need it or an
    // existing fallback command is still settling. Otherwise this single
    // callback keeps Worklets' global display-link loop alive forever.
    const active =
      command !== undefined ||
      (canStartInteractive && !nativePagerGestureInputEnabled);
    driverFrameCallback.setActive(active);
    return () => {
      driverFrameCallback.setActive(false);
    };
  }, [
    canStartInteractive,
    command,
    driverFrameCallback,
    nativePagerGestureInputEnabled,
  ]);

  const programmaticTurnId =
    command?.ready && !command.interactive ? command.id : undefined;
  useEffect(() => {
    if (!programmaticTurnId || !command) {
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
    if (command) {
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
      // Keep rapid-tap jitter inside the tap recognizer. Once the finger moves
      // beyond that small tolerance, the native drag path still takes over.
      .activeOffsetX([-panActivationDistance, panActivationDistance])
      .failOffsetY([-12, 12])
      .onBegin((event) => {
        "worklet";
        gestureRequestHandled.value = false;
        riffleState.modify((current) => {
          current.active = false;
          current.armedAtMs = 0;
          current.nextAtMs = 0;
          return current;
        });
        gestureProbe.modify((probe) => {
          probe.mode = 0;
          probe.touchStartLocalX = event.x;
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
        const existingProbeMode = gestureProbe.value.mode;
        if (existingProbeMode === 5) {
          return;
        }

        const startLocalX = gestureProbe.value.touchStartLocalX;
        const riffleCandidate = pageRiffleCandidateForTouch(startLocalX, width);
        if (
          rapidPageTurnEnabled &&
          !gestureRequestHandled.value &&
          riffleCandidate !== undefined
        ) {
          const disposition = pageRiffleGestureDisposition({
            direction: riffleCandidate.direction,
            startEdgeDistance: riffleCandidate.startEdgeDistance,
            translationX: event.translationX,
            translationY: event.translationY,
            interactionWidth: width,
            minimumHorizontalTravel: panActivationDistance,
          });
          if (disposition !== PAGE_RIFFLE_INWARD) {
            if (disposition === PAGE_RIFFLE_ARMED && existingProbeMode !== 4) {
              const armedAtMs = Date.now();
              gestureProbe.modify((probe) => {
                probe.mode = 4;
                probe.direction = riffleCandidate.direction;
                probe.lastTime = workletTimeSeconds();
                return probe;
              });
              riffleState.modify((current) => {
                current.active = false;
                current.armedAtMs = armedAtMs;
                current.direction = riffleCandidate.direction;
                current.nextAtMs = 0;
                return current;
              }, true);
              scheduleOnRN(dispatchRiffleClockActive, true);
            } else if (
              disposition !== PAGE_RIFFLE_ARMED &&
              existingProbeMode === 4
            ) {
              riffleState.modify((current) => {
                current.active = false;
                current.armedAtMs = 0;
                current.nextAtMs = 0;
                return current;
              }, true);
              gestureProbe.modify((probe) => {
                probe.mode = 0;
                return probe;
              });
              scheduleOnRN(dispatchRiffleClockActive, false);
            }
            // Outward motion owns no normal turn. Once it reaches the outer
            // 15%, it must remain there for the full dwell before page one.
            return;
          }
          if (existingProbeMode === 4) {
            riffleState.modify((current) => {
              current.active = false;
              current.armedAtMs = 0;
              current.nextAtMs = 0;
              return current;
            }, true);
            gestureProbe.modify((probe) => {
              probe.mode = 0;
              return probe;
            });
            scheduleOnRN(dispatchRiffleClockActive, false);
          }
        }

        const direction = normalPageTurnDirectionForTouch(
          startLocalX,
          event.translationX,
          spread,
          width,
        );
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
            const startLocalY = event.y - event.translationY;
            const startBookX = pageTurnStartBookXForTouch(
              startLocalX,
              direction,
              spread,
              physicalPageWidth,
              width,
            );
            const startBookY = clampUnit(startLocalY / height);
            const settlingIncomingPage = !spread && direction === -1;
            const initialProgress = clampUnit(
              Math.abs(event.translationX) /
                Math.max(1, physicalPageWidth * 0.72),
            );
            const initialBookX = bookXForGestureTravel(
              startBookX,
              event.translationX,
              direction,
              physicalPageWidth,
            );
            const initialFingerX = Math.min(
              1,
              Math.max(-1, 1 + initialBookX - startBookX),
            );
            const nativeGestureStarted =
              nativePagerGestureInputEnabled &&
              nativePagerNativeId !== undefined
                ? beginNativePagerGestureOnUI(nativePagerNativeId, {
                    direction,
                    startBookX,
                    fingerX: initialFingerX,
                    turnProgress: initialProgress,
                  })
                : false;
            if (nativeGestureStarted === true) {
              gestureProbe.modify((probe) => {
                probe.mode = 3;
                probe.direction = direction;
                probe.startBookX = startBookX;
                probe.currentBookX = initialBookX;
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
              setPageTurnWorkletTuning(
                current,
                direction === -1 ? reverseCoreTuning : forwardCoreTuning,
              );
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
            const startBookX = pageTurnStartBookXForTouch(
              startLocalX,
              direction,
              spread,
              physicalPageWidth,
              width,
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
        if (probeMode === 5) {
          return;
        }
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
                ? updateNativePagerGestureOnUI(nativePagerNativeId, {
                    fingerX: Math.min(
                      1,
                      Math.max(
                        -1,
                        1 + updatedProbe.currentBookX - updatedProbe.startBookX,
                      ),
                    ),
                    turnProgress: updatedProbe.turnProgress,
                  })
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
      .onEnd((event) => {
        "worklet";
        const releasedAtSeconds = workletTimeSeconds();
        let probe = gestureProbe.value;
        if (probe.mode === 4 || probe.mode === 5) {
          riffleState.modify((current) => {
            current.active = false;
            current.armedAtMs = 0;
            current.nextAtMs = 0;
            return current;
          }, true);
          gestureProbe.modify((current) => {
            current.mode = 0;
            return current;
          });
          scheduleOnRN(dispatchRiffleClockActive, false);
          return;
        }
        if (probe.mode === 0) {
          if (gestureRequestHandled.value) {
            return;
          }
          const terminalStartLocalX = gestureProbe.value.touchStartLocalX;
          const terminalRiffleCandidate = pageRiffleCandidateForTouch(
            terminalStartLocalX,
            width,
          );
          if (
            rapidPageTurnEnabled &&
            terminalRiffleCandidate !== undefined &&
            pageRiffleGestureDisposition({
              direction: terminalRiffleCandidate.direction,
              startEdgeDistance: terminalRiffleCandidate.startEdgeDistance,
              translationX: event.translationX,
              translationY: event.translationY,
              interactionWidth: width,
              minimumHorizontalTravel: panActivationDistance,
            }) !== PAGE_RIFFLE_INWARD
          ) {
            return;
          }
          const terminalDirectionFromTravel = pageTurnTerminalDirection(
            event.translationX,
            event.translationY,
            onePhysicalPixel,
          );
          const terminalDirection =
            terminalDirectionFromTravel === undefined
              ? undefined
              : normalPageTurnDirectionForTouch(
                  terminalStartLocalX,
                  event.translationX,
                  spread,
                  width,
                );
          const canTurn =
            terminalDirection === 1 ? canTurnForward : canTurnBackward;
          if (terminalDirection === undefined || !canTurn) {
            return;
          }
          const startLocalX = terminalStartLocalX;
          const startBookX = pageTurnStartBookXForTouch(
            startLocalX,
            terminalDirection,
            spread,
            physicalPageWidth,
            width,
          );
          const terminalSample = pageTurnGestureReleaseSample(
            startBookX,
            event.translationX,
            event.velocityX,
            terminalDirection,
            physicalPageWidth,
          );
          const fingerX = Math.min(
            1,
            Math.max(-1, 1 + terminalSample.currentBookX - startBookX),
          );
          const nativeGestureStarted =
            nativePagerGestureInputEnabled && nativePagerNativeId !== undefined
              ? beginNativePagerGestureOnUI(nativePagerNativeId, {
                  direction: terminalDirection,
                  startBookX,
                  fingerX,
                  turnProgress: terminalSample.turnProgress,
                })
              : false;
          gestureProbe.modify((current) => {
            current.mode = nativeGestureStarted === true ? 3 : 2;
            current.direction = terminalDirection;
            current.startBookX = startBookX;
            current.currentBookX = terminalSample.currentBookX;
            current.throwVelocity = terminalSample.throwVelocity;
            current.throwAcceleration = 0;
            current.lastThrowVelocity = terminalSample.throwVelocity;
            current.lastTime = releasedAtSeconds;
            current.turnProgress = terminalSample.turnProgress;
            return current;
          });
          probe = gestureProbe.value;
        }
        const releaseSample = pageTurnGestureReleaseSample(
          probe.startBookX,
          event.translationX,
          event.velocityX,
          probe.direction,
          physicalPageWidth,
        );
        if (probe.mode === 3) {
          const releaseTuning =
            probe.direction === -1 ? reverseCoreTuning : forwardCoreTuning;
          const fingerX = Math.min(
            1,
            Math.max(-1, 1 + releaseSample.currentBookX - probe.startBookX),
          );
          if (nativePagerNativeId !== undefined) {
            updateNativePagerGestureOnUI(nativePagerNativeId, {
              fingerX,
              turnProgress: releaseSample.turnProgress,
            });
          }
          const nativeEnded =
            nativePagerNativeId !== undefined
              ? endNativePagerGestureOnUI(nativePagerNativeId, {
                  fingerX,
                  throwVelocity: releaseSample.throwVelocity,
                  throwAcceleration: probe.throwAcceleration,
                  pageWeight: releaseTuning.pageWeight,
                  commitThreshold: releaseTuning.gestureCommitThreshold,
                  slowCommitEdgeX: SLOW_COMMIT_EDGE_X,
                  minimumSpeedScale: releaseTuning.gestureMinimumSpeedScale,
                  maximumSpeedScale: releaseTuning.gestureMaximumSpeedScale,
                  velocityGain: releaseTuning.gestureVelocityGain,
                  idleDecaySeconds: releaseTuning.gestureIdleDecaySeconds,
                })
              : undefined;
          if (nativeEnded !== true) {
            scheduleOnRN(dispatchGestureRelease, {
              direction: probe.direction,
              interactive: false,
              startBookX: probe.startBookX,
              currentBookX: releaseSample.currentBookX,
              throwVelocity: releaseSample.throwVelocity,
              throwAcceleration: probe.throwAcceleration,
              turnProgress: releaseSample.turnProgress,
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
            currentBookX: releaseSample.currentBookX,
            throwVelocity: releaseSample.throwVelocity,
            throwAcceleration: probe.throwAcceleration,
            turnProgress: releaseSample.turnProgress,
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
        gestureTarget.modify((target) => {
          target.bookX = releaseSample.currentBookX;
          target.bookY = clampUnit(event.y / height);
          target.turnProgress = releaseSample.turnProgress;
          target.pendingRevision += 1;
          return target;
        });
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
              throwVelocity: releaseSample.throwVelocity,
              throwAcceleration: interactiveProbe.throwAcceleration,
              turnProgress: releaseSample.turnProgress,
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
        if (probeMode === 4 || probeMode === 5) {
          riffleState.modify((current) => {
            current.active = false;
            current.armedAtMs = 0;
            current.nextAtMs = 0;
            return current;
          }, true);
          scheduleOnRN(dispatchRiffleClockActive, false);
        }
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
      // Pan recognition also stays live. Each accepted input owns a separate
      // sheet; neither path may preempt an animation that is still visible.
      .enabled(gesturesEnabled || nativePagerTapInputEnabled)
      .maxDistance(tapMaxDistance)
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
          if (
            nativePagerTapNeedsRNFallback(
              nativePagerTapInputEnabled,
              nativeResult,
            )
          ) {
            scheduleOnRN(dispatchTapTurn, -1, requestedAtMs);
          }
        } else if (event.x >= width * 0.76 && canTurnForward) {
          const nativeResult =
            nativePagerTapInputEnabled && nativePagerNativeId !== undefined
              ? consumeNativePagerInputOnUI(nativePagerNativeId, 1)
              : undefined;
          if (
            nativePagerTapNeedsRNFallback(
              nativePagerTapInputEnabled,
              nativeResult,
            )
          ) {
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
    dispatchRapidTurn,
    dispatchRiffleClockActive,
    dispatchTapTurn,
    onePhysicalPixel,
    nativePagerTapInputEnabled,
    nativePagerGestureInputEnabled,
    nativePagerNativeId,
    panActivationDistance,
    physicalPageWidth,
    rapidPageTurnEnabled,
    riffleState,
    spread,
    state,
    tapMaxDistance,
    forwardCoreTuning,
    reverseCoreTuning,
    width,
  ]);

  return { frame, gesture };
}
