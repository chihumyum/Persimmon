import {
  PAGE_TURN_WORKLET_DRAG,
  PAGE_TURN_WORKLET_IDLE,
  PAGE_TURN_WORKLET_NO_OUTCOME,
  advancePageTurnWorklet,
  createPageTurnWorkletState,
  playPageTurnWorklet,
  playReleasedPageTurnWorklet,
  setPageTurnWorkletTuning,
  type PageTurnTuning,
} from "@persimmon/page-turn-core";
import { useEffect, useMemo } from "react";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import {
  updatePageTurnNativeSharedFrame,
  usePageTurnNativeSharedFrame,
} from "./page-turn-native-shared-frame";
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

function useNativeProgrammaticPageTurnLane(
  width: number,
  height: number,
  spread: boolean,
  automaticTuning: AutomaticPageTurnTuning,
  gestureTuning: GesturePageTurnTuning,
  command: NativeProgrammaticPageTurnCommand | undefined,
  onStarted: (turnId: string) => void,
  onOutcome: (turnId: string, outcome: number) => void,
) {
  const automaticCoreTuning = useMemo(
    () => automaticTuningForCore(automaticTuning),
    [automaticTuning],
  );
  const gestureCoreTuning = useMemo(
    () => gestureTuningForCore(gestureTuning),
    [gestureTuning],
  );
  const state = useSharedValue(createPageTurnWorkletState(automaticCoreTuning));
  const frame = usePageTurnNativeSharedFrame(width, height, spread);
  const commandId = command?.ready ? command.id : undefined;
  const commandDirection = command?.direction;
  const settlingIncomingPage = command?.settlingIncomingPage;
  const commandMotion = command?.motion;
  const gestureRelease = command?.gestureRelease;
  const playbackSpeed =
    command?.motion === "gesture" ? 1 : automaticTuning.playbackSpeed;

  useFrameCallback(({ timeSincePreviousFrame }) => {
    "worklet";
    if (
      timeSincePreviousFrame === null ||
      state.value.phase === PAGE_TURN_WORKLET_IDLE ||
      state.value.phase === PAGE_TURN_WORKLET_DRAG
    ) {
      return;
    }
    state.modify((current) => {
      if (
        !advancePageTurnWorklet(
          current,
          (timeSincePreviousFrame / 1000) * playbackSpeed,
        )
      ) {
        return current;
      }
      updatePageTurnNativeSharedFrame(current, frame);
      if (
        commandId !== undefined &&
        current.outcome !== PAGE_TURN_WORKLET_NO_OUTCOME &&
        !current.outcomeNotified
      ) {
        current.outcomeNotified = true;
        scheduleOnRN(onOutcome, commandId, current.outcome);
      }
      return current;
    }, true);
  }, true);

  useEffect(() => {
    if (
      !commandId ||
      commandDirection === undefined ||
      settlingIncomingPage === undefined ||
      commandMotion === undefined
    ) {
      return;
    }
    scheduleOnUI(
      (
        nextDirection: 1 | -1,
        settlingIncomingPage: boolean,
        automaticTuning: PageTurnTuning,
        gestureTuning: PageTurnTuning,
        motion: "tap" | "gesture",
        release: NativeProgrammaticPageTurnCommand["gestureRelease"],
      ) => {
        "worklet";
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
          } else {
            playPageTurnWorklet(current, nextDirection, settlingIncomingPage);
          }
          updatePageTurnNativeSharedFrame(current, frame);
          scheduleOnRN(onStarted, commandId);
          return current;
        }, true);
      },
      commandDirection,
      settlingIncomingPage,
      automaticCoreTuning,
      gestureCoreTuning,
      commandMotion,
      gestureRelease,
    );
  }, [
    commandDirection,
    commandId,
    automaticCoreTuning,
    gestureCoreTuning,
    frame,
    commandMotion,
    onStarted,
    settlingIncomingPage,
    state,
    gestureRelease,
  ]);

  useEffect(() => {
    if (commandId !== undefined) {
      return;
    }
    scheduleOnUI(() => {
      "worklet";
      state.modify((current) => {
        current.phase = PAGE_TURN_WORKLET_IDLE;
        current.outcome = PAGE_TURN_WORKLET_NO_OUTCOME;
        current.outcomeNotified = false;
        return current;
      }, true);
    });
  }, [commandId, state]);

  return frame;
}

/**
 * Four persistent animation lanes back rapid edge taps without allocating a
 * controller, profile, or render buffer for each turn. Every lane advances on
 * the UI runtime and sends React only its terminal turn id and outcome.
 */
export function useNativePageTurnPool({
  width,
  height,
  spread,
  automaticTuning,
  gestureTuning,
  commands,
  onStarted,
  onOutcome,
}: NativePageTurnPoolOptions): NativePageTurnPool {
  const frame0 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[0],
    onStarted,
    onOutcome,
  );
  const frame1 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[1],
    onStarted,
    onOutcome,
  );
  const frame2 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[2],
    onStarted,
    onOutcome,
  );
  const frame3 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[3],
    onStarted,
    onOutcome,
  );
  return {
    frames: [frame0, frame1, frame2, frame3],
  };
}
