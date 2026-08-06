import type { PageTurnNativeSharedFrame } from "./page-turn-native-shared-frame";
import type { AutomaticPageTurnTuning } from "./automatic-page-turn-tuning";
import type { GesturePageTurnTuning } from "./gesture-page-turn-tuning";
import type { PAGE_TURN_LANE_HARD_LIMIT } from "./page-turn-concurrency";
import type { ReleasedPageTurnGesture } from "@persimmon/page-turn-core";

export interface NativeProgrammaticPageTurnCommand {
  readonly id: string;
  readonly direction: 1 | -1;
  readonly ready: boolean;
  readonly startAtMs: number;
  /**
   * Automatic lanes remain frozen on their initial frame until the Canvas has
   * presented that mesh. Gesture handoffs bypass this gate because the shared
   * interactive frame is already visible.
   */
  readonly readyToStart: boolean;
  readonly settlingIncomingPage: boolean;
  readonly motion: "tap" | "rapid" | "gesture";
  /**
   * Automatic turns may be accelerated while a rapid-tap burst is active.
   * Gesture releases always use their physical 1x clock.
   */
  readonly playbackSpeed?: number;
  readonly gestureRelease?: ReleasedPageTurnGesture;
}

export interface NativePageTurnPoolOptions {
  readonly width: number;
  readonly height: number;
  readonly spread: boolean;
  readonly automaticTuning: AutomaticPageTurnTuning;
  readonly gestureTuning: GesturePageTurnTuning;
  readonly commands: readonly (NativeProgrammaticPageTurnCommand | undefined)[];
  readonly onPrepared: (turnId: string) => void;
  readonly onStarted: (
    turnId: string,
    startedAtMs: number,
    playbackSpeed: number,
  ) => void;
  readonly onOutcome: (
    turnId: string,
    outcome: number,
    completedAtMs: number,
  ) => void;
}

export interface NativePageTurnPool {
  readonly frames: FixedLengthArray<
    PageTurnNativeSharedFrame,
    typeof PAGE_TURN_LANE_HARD_LIMIT
  >;
  readonly authorizeStart: (
    lane: number,
    turnId: string,
    startAtMs: number,
  ) => void;
}

type FixedLengthArray<
  Value,
  Length extends number,
  Result extends readonly Value[] = [],
> = Result["length"] extends Length
  ? Result
  : FixedLengthArray<Value, Length, readonly [...Result, Value]>;

export { useNativePageTurnPool } from "./native-page-turn-pool.native";
