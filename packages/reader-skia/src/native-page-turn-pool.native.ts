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
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
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
import type {
  NativePageTurnPool,
  NativePageTurnPoolOptions,
  NativeProgrammaticPageTurnCommand,
} from "./native-page-turn-pool";
import { useStableRNDispatcher } from "./use-stable-rn-dispatcher";

interface NativeProgrammaticPageTurnLane {
  readonly frame: ReturnType<typeof usePageTurnNativeSharedFrame>;
  readonly authorizeStart: (turnId: string, startAtMs: number) => void;
}

function useNativeProgrammaticPageTurnLane(
  width: number,
  height: number,
  spread: boolean,
  automaticTuning: AutomaticPageTurnTuning,
  gestureTuning: GesturePageTurnTuning,
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
    () => automaticTuningForCore(automaticTuning),
    [automaticTuning],
  );
  const gestureCoreTuning = useMemo(
    () => gestureTuningForCore(gestureTuning),
    [gestureTuning],
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
        : automaticTuning.playbackSpeed;
  const playbackSpeed = useSharedValue(requestedPlaybackSpeed);
  useEffect(() => {
    playbackSpeed.value = requestedPlaybackSpeed;
  }, [playbackSpeed, requestedPlaybackSpeed]);

  useFrameCallback(({ timeSincePreviousFrame }) => {
    "worklet";
    if (
      timeSincePreviousFrame === null ||
      commandId === undefined ||
      scheduledCommandId.value !== commandId
    ) {
      return;
    }
    if (!scheduledStarted.value) {
      const now = Date.now();
      if (!scheduledReadyToStart.value || now < scheduledStartAtMs.value) {
        return;
      }
      scheduledStarted.value = true;
      scheduleOnRN(onStarted, commandId, now, playbackSpeed.value);
      // The initial paper profile has already crossed the presentation
      // barrier. Start physical time on the following display frame so a long
      // frame that opened the gate cannot consume part of the animation.
      return;
    }
    if (
      state.value.phase === PAGE_TURN_WORKLET_IDLE ||
      state.value.phase === PAGE_TURN_WORKLET_DRAG
    ) {
      return;
    }
    state.modify((current) => {
      if (
        advancePageTurnWorklet(
          current,
          (timeSincePreviousFrame / 1000) * playbackSpeed.value,
        )
      ) {
        updatePageTurnNativeSharedFrame(current, frame);
      }
      if (
        commandId !== undefined &&
        current.outcome !== PAGE_TURN_WORKLET_NO_OUTCOME &&
        !current.outcomeNotified
      ) {
        current.outcomeNotified = true;
        scheduleOnRN(onOutcome, commandId, current.outcome, Date.now());
      }
      return current;
    }, true);
  }, true);

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
        motion: "tap" | "gesture",
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
  gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
    gestureTuning,
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
