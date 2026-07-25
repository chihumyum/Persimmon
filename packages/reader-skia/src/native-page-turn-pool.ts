import type { PageTurnNativeSharedFrame } from "./page-turn-native-shared-frame";
import type { AutomaticPageTurnTuning } from "./automatic-page-turn-tuning";
import type { GesturePageTurnTuning } from "./gesture-page-turn-tuning";
import type { ReleasedPageTurnGesture } from "@persimmon/page-turn-core";

export interface NativeProgrammaticPageTurnCommand {
  readonly id: string;
  readonly direction: 1 | -1;
  readonly ready: boolean;
  readonly settlingIncomingPage: boolean;
  readonly motion: "tap" | "gesture";
  readonly gestureRelease?: ReleasedPageTurnGesture;
}

export interface NativePageTurnPoolOptions {
  readonly width: number;
  readonly height: number;
  readonly spread: boolean;
  readonly automaticTuning: AutomaticPageTurnTuning;
  readonly gestureTuning: GesturePageTurnTuning;
  readonly commands: readonly (NativeProgrammaticPageTurnCommand | undefined)[];
  readonly onStarted: (turnId: string) => void;
  readonly onOutcome: (turnId: string, outcome: number) => void;
}

export interface NativePageTurnPool {
  readonly frames: readonly [
    PageTurnNativeSharedFrame,
    PageTurnNativeSharedFrame,
    PageTurnNativeSharedFrame,
    PageTurnNativeSharedFrame,
  ];
}

/**
 * The Web renderer owns one reference controller per paper and never consumes
 * native shared frames. Keeping this platform stub free of worklet imports also
 * prevents native UI-runtime closures from entering the Web module graph.
 */
export function useNativePageTurnPool(
  _options: NativePageTurnPoolOptions,
): NativePageTurnPool {
  return {
    frames: [] as unknown as NativePageTurnPool["frames"],
  };
}
