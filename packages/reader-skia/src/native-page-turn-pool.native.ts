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
  const frame4 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[4],
    onStarted,
    onOutcome,
  );
  const frame5 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[5],
    onStarted,
    onOutcome,
  );
  const frame6 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[6],
    onStarted,
    onOutcome,
  );
  const frame7 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[7],
    onStarted,
    onOutcome,
  );
  const frame8 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[8],
    onStarted,
    onOutcome,
  );
  const frame9 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[9],
    onStarted,
    onOutcome,
  );
  const frame10 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[10],
    onStarted,
    onOutcome,
  );
  const frame11 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[11],
    onStarted,
    onOutcome,
  );
  const frame12 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[12],
    onStarted,
    onOutcome,
  );
  const frame13 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[13],
    onStarted,
    onOutcome,
  );
  const frame14 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[14],
    onStarted,
    onOutcome,
  );
  const frame15 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[15],
    onStarted,
    onOutcome,
  );
  const frame16 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[16],
    onStarted,
    onOutcome,
  );
  const frame17 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[17],
    onStarted,
    onOutcome,
  );
  const frame18 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[18],
    onStarted,
    onOutcome,
  );
  const frame19 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[19],
    onStarted,
    onOutcome,
  );
  const frame20 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[20],
    onStarted,
    onOutcome,
  );
  const frame21 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[21],
    onStarted,
    onOutcome,
  );
  const frame22 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[22],
    onStarted,
    onOutcome,
  );
  const frame23 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[23],
    onStarted,
    onOutcome,
  );
  const frame24 = useNativeProgrammaticPageTurnLane(
    width,
    height,
    spread,
    automaticTuning,
    gestureTuning,
    commands[24],
    onStarted,
    onOutcome,
  );
  return {
    frames: [
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
      frame11,
      frame12,
      frame13,
      frame14,
      frame15,
      frame16,
      frame17,
      frame18,
      frame19,
      frame20,
      frame21,
      frame22,
      frame23,
      frame24,
    ],
  };
}
