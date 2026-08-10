import {
  PAGE_TURN_WORKLET_DRAG,
  PAGE_TURN_WORKLET_IDLE,
  PAGE_TURN_WORKLET_NO_OUTCOME,
  advancePageTurnWorklet,
  catchUpPageTurnWorklet,
  createPageTurnWorkletState,
  playPageTurnWorklet,
  playReleasedPageTurnWorklet,
  setPageTurnWorkletTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";
import { useCallback, useEffect, useMemo } from "react";
import {
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import {
  hidePageTurnNativeSharedFrame,
  updatePageTurnNativeSharedFrame,
  usePageTurnNativeSharedFrame,
} from "./page-turn-native-shared-frame";
import { afterSkiaPaint } from "./skia-lifecycle";
import {
  automaticTuningForCore,
  type AutomaticPageTurnTuning,
} from "./automatic-page-turn-tuning";
import {
  gestureTuningForCore,
  type GesturePageTurnTuning,
} from "./gesture-page-turn-tuning";
import {
  reverseAutomaticTuningForCore,
  type ReverseAutomaticPageTurnTuning,
} from "./reverse-automatic-page-turn-tuning";
import {
  reverseGestureTuningForCore,
  type ReverseGesturePageTurnTuning,
} from "./reverse-gesture-page-turn-tuning";
import type {
  NativePageTurnPool,
  NativePageTurnPoolOptions,
  NativeProgrammaticPageTurnCommand,
} from "./native-page-turn-pool";
import { pageTurnTuningForLayoutDirection } from "./page-turn-direction";
import { useStableRNDispatcher } from "./use-stable-rn-dispatcher";

interface NativeProgrammaticPageTurnLane {
  readonly frame: ReturnType<typeof usePageTurnNativeSharedFrame>;
  readonly authorizeStart: (turnId: string, startAtMs: number) => void;
}

// A prepared fallback command can disappear from the React texture prefix for
// a render while its UI-runtime animation is already running. Keep that lane
// alive longer than the compositor's maximum 900 ms turn so the terminal
// outcome is still delivered, then put the display-link subscriber to sleep.
const NATIVE_PAGE_TURN_LANE_IDLE_GRACE_MS = 1_200;

function useNativeProgrammaticPageTurnLane(
  width: number,
  height: number,
  spread: boolean,
  automaticTuning: AutomaticPageTurnTuning,
  reverseAutomaticTuning: ReverseAutomaticPageTurnTuning,
  gestureTuning: GesturePageTurnTuning,
  reverseGestureTuning: ReverseGesturePageTurnTuning,
  command: NativeProgrammaticPageTurnCommand | undefined,
  onPrepared: (turnId: string) => void,
  onStarted: (
    turnId: string,
    startedAtMs: number,
    playbackSpeed: number,
  ) => void,
  onOutcome: (turnId: string, outcome: number, completedAtMs: number) => void,
): NativeProgrammaticPageTurnLane {
  const automaticCoreTuning = useMemo(
    () =>
      pageTurnTuningForLayoutDirection(
        automaticTuningForCore(automaticTuning),
        reverseAutomaticTuningForCore(reverseAutomaticTuning),
        command?.direction ?? 1,
        spread,
      ),
    [automaticTuning, command?.direction, reverseAutomaticTuning, spread],
  );
  const gestureCoreTuning = useMemo(
    () =>
      pageTurnTuningForLayoutDirection(
        gestureTuningForCore(gestureTuning),
        reverseGestureTuningForCore(reverseGestureTuning),
        command?.direction ?? 1,
        spread,
      ),
    [command?.direction, gestureTuning, reverseGestureTuning, spread],
  );
  const state = useSharedValue(createPageTurnWorkletState(automaticCoreTuning));
  const scheduledCommandId = useSharedValue<string | undefined>(undefined);
  const scheduledStartAtMs = useSharedValue(0);
  const scheduledReadyToStart = useSharedValue(false);
  const scheduledStarted = useSharedValue(false);
  const frame = usePageTurnNativeSharedFrame(width, height, spread);
  const commandId = command?.ready ? command.id : undefined;
  const commandDirection = command?.direction;
  const commandStartAtMs = command?.startAtMs;
  const commandReadyToStart = command?.readyToStart ?? false;
  const settlingIncomingPage = command?.settlingIncomingPage;
  const commandMotion = command?.motion;
  const gestureRelease = command?.gestureRelease;
  const requestedPlaybackSpeed =
    command?.motion === "gesture"
      ? 1
      : command?.playbackSpeed &&
          Number.isFinite(command.playbackSpeed) &&
          command.playbackSpeed > 0
        ? command.playbackSpeed
        : pageTurnTuningForLayoutDirection(
            automaticTuning,
            reverseAutomaticTuning,
            command?.direction ?? 1,
            spread,
          ).playbackSpeed;
  const playbackSpeed = useSharedValue(requestedPlaybackSpeed);
  useEffect(() => {
    playbackSpeed.value = requestedPlaybackSpeed;
  }, [playbackSpeed, requestedPlaybackSpeed]);

  const advanceLaneFrame = useCallback(
    ({ timeSincePreviousFrame }: FrameInfo) => {
      "worklet";
      const activeCommandId = scheduledCommandId.value;
      if (timeSincePreviousFrame === null || activeCommandId === undefined) {
        return;
      }
      if (!scheduledStarted.value) {
        const now = Date.now();
        if (!scheduledReadyToStart.value || now < scheduledStartAtMs.value) {
          return;
        }
        scheduledStarted.value = true;
        scheduleOnRN(onStarted, activeCommandId, now, playbackSpeed.value);
        // The initial paper profile has already crossed the presentation
        // barrier. Start physical time on the following display frame so a
        // long frame that opened the gate cannot consume the animation.
        return;
      }
      state.modify((current) => {
        if (
          current.phase !== PAGE_TURN_WORKLET_IDLE &&
          current.phase !== PAGE_TURN_WORKLET_DRAG &&
          advancePageTurnWorklet(
            current,
            (timeSincePreviousFrame / 1000) * playbackSpeed.value,
          )
        ) {
          updatePageTurnNativeSharedFrame(current, frame);
        }
        if (
          current.outcome !== PAGE_TURN_WORKLET_NO_OUTCOME &&
          !current.outcomeNotified
        ) {
          current.outcomeNotified = true;
          scheduleOnRN(onOutcome, activeCommandId, current.outcome, Date.now());
        }
        return current;
      }, true);
    },
    [
      frame,
      onOutcome,
      onStarted,
      playbackSpeed,
      scheduledCommandId,
      scheduledReadyToStart,
      scheduledStartAtMs,
      scheduledStarted,
      state,
    ],
  );
  const laneFrameCallback = useFrameCallback(advanceLaneFrame, false);

  useEffect(() => {
    // The pool is persistent, but an idle lane must not be a persistent
    // display-link subscriber. With eleven reserved lanes, leaving these
    // callbacks active after their commands completed kept Worklets' global
    // requestAnimationFrame loop alive forever and saturated Android's UI
    // thread after a rapid-tap burst.
    if (commandId !== undefined) {
      laneFrameCallback.setActive(true);
      return;
    }
    const timeout = setTimeout(() => {
      laneFrameCallback.setActive(false);
    }, NATIVE_PAGE_TURN_LANE_IDLE_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [commandId, laneFrameCallback]);
  useEffect(
    () => () => {
      laneFrameCallback.setActive(false);
    },
    [laneFrameCallback],
  );

  useEffect(() => {
    if (
      !commandId ||
      commandDirection === undefined ||
      commandStartAtMs === undefined ||
      settlingIncomingPage === undefined ||
      commandMotion === undefined
    ) {
      return;
    }
    scheduleOnUI(
      (
        nextDirection: 1 | -1,
        startAtMs: number,
        readyToStart: boolean,
        settlingIncomingPage: boolean,
        automaticTuning: PageTurnTuning,
        gestureTuning: PageTurnTuning,
        motion: "tap" | "rapid" | "gesture",
        release: NativeProgrammaticPageTurnCommand["gestureRelease"],
      ) => {
        "worklet";
        if (scheduledCommandId.value === commandId) {
          return;
        }
        scheduledCommandId.value = commandId;
        scheduledStartAtMs.value = startAtMs;
        scheduledReadyToStart.value = readyToStart;
        scheduledStarted.value = false;
        state.modify((current) => {
          setPageTurnWorkletTuning(
            current,
            motion === "gesture" ? gestureTuning : automaticTuning,
          );
          if (motion === "gesture" && release !== undefined) {
            playReleasedPageTurnWorklet(
              current,
              nextDirection,
              settlingIncomingPage,
              release,
            );
            const releasedAtSeconds = release.releasedAtSeconds;
            const catchUpSeconds =
              releasedAtSeconds !== undefined &&
              Number.isFinite(releasedAtSeconds)
                ? Math.min(
                    1,
                    Math.max(0, Date.now() / 1000 - releasedAtSeconds),
                  )
                : 0;
            catchUpPageTurnWorklet(current, catchUpSeconds);
          } else {
            playPageTurnWorklet(current, nextDirection, settlingIncomingPage);
          }
          updatePageTurnNativeSharedFrame(current, frame);
          return current;
        }, true);
        scheduleOnRN(onPrepared, commandId);
      },
      commandDirection,
      commandStartAtMs,
      commandReadyToStart,
      settlingIncomingPage,
      automaticCoreTuning,
      gestureCoreTuning,
      commandMotion,
      gestureRelease,
    );
  }, [
    commandDirection,
    commandId,
    commandReadyToStart,
    commandStartAtMs,
    automaticCoreTuning,
    gestureCoreTuning,
    frame,
    commandMotion,
    onPrepared,
    scheduledCommandId,
    scheduledReadyToStart,
    scheduledStartAtMs,
    scheduledStarted,
    settlingIncomingPage,
    state,
    gestureRelease,
  ]);

  const authorizeStart = useCallback(
    (turnId: string, startAtMs: number) => {
      scheduleOnUI(
        (nextTurnId: string, nextStartAtMs: number) => {
          "worklet";
          if (
            scheduledCommandId.value !== nextTurnId ||
            scheduledStarted.value
          ) {
            return;
          }
          scheduledStartAtMs.value = nextStartAtMs;
          scheduledReadyToStart.value = true;
        },
        turnId,
        startAtMs,
      );
    },
    [
      scheduledCommandId,
      scheduledReadyToStart,
      scheduledStartAtMs,
      scheduledStarted,
    ],
  );

  useEffect(() => {
    if (!commandId || commandStartAtMs === undefined || !commandReadyToStart) {
      return;
    }
    authorizeStart(commandId, commandStartAtMs);
  }, [authorizeStart, commandId, commandReadyToStart, commandStartAtMs]);

  useEffect(() => {
    if (commandId !== undefined) {
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      scheduleOnUI(() => {
        "worklet";
        scheduledCommandId.value = undefined;
        scheduledReadyToStart.value = false;
        scheduledStarted.value = false;
        state.modify((current) => {
          current.phase = PAGE_TURN_WORKLET_IDLE;
          current.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
          current.outcomeNotified = false;
          return current;
        }, true);
      });
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
    }, NATIVE_PAGE_TURN_LANE_IDLE_GRACE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    commandId,
    frame,
    scheduledCommandId,
    scheduledReadyToStart,
    scheduledStarted,
    state,
  ]);

  return useMemo(() => ({ frame, authorizeStart }), [authorizeStart, frame]);
}

/**
 * A hard-capped persistent pool backs the dynamically enabled lane count
 * without allocating a controller, profile, or render buffer during a burst.
 * Every lane advances on the UI runtime and sends React only its terminal turn
 * id and outcome.
 */
export function useNativePageTurnPool({
  width,
  height,
  spread,
  automaticTuning,
  reverseAutomaticTuning,
  gestureTuning,
  reverseGestureTuning,
  commands,
  onPrepared,
  onStarted,
  onOutcome,
}: NativePageTurnPoolOptions): NativePageTurnPool {
  const dispatchPrepared = useStableRNDispatcher(onPrepared);
  const dispatchStarted = useStableRNDispatcher(onStarted);
  const dispatchOutcome = useStableRNDispatcher(onOutcome);
  const frame0 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[0],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame1 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[1],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame2 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[2],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame3 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[3],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame4 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[4],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame5 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[5],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame6 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[6],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame7 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[7],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame8 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[8],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame9 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[9],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const frame10 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    reverseAutomaticTuning,
    gestureTuning,
    reverseGestureTuning,
    commands[10],
    dispatchPrepared,
    dispatchStarted,
    dispatchOutcome,
  );
  const lanes = useMemo(
    () => [
      frame0,
      frame1,
      frame2,
      frame3,
      frame4,
      frame5,
      frame6,
      frame7,
      frame8,
      frame9,
      frame10,
    ],
    [
      frame0,
      frame1,
      frame2,
      frame3,
      frame4,
      frame5,
      frame6,
      frame7,
      frame8,
      frame9,
      frame10,
    ],
  );
  const authorizeStart = useCallback(
    (lane: number, turnId: string, startAtMs: number) => {
      lanes[lane]?.authorizeStart(turnId, startAtMs);
    },
    [lanes],
  );
  return {
    frames: [
      frame0.frame,
      frame1.frame,
      frame2.frame,
      frame3.frame,
      frame4.frame,
      frame5.frame,
      frame6.frame,
      frame7.frame,
      frame8.frame,
      frame9.frame,
      frame10.frame,
    ],
    authorizeStart,
  };
}
