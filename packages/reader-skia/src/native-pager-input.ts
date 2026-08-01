export type NativePagerInputConfigurator<Canvas> = (
  canvas: Canvas,
  enabled: boolean,
) => unknown;

export interface NativePagerGestureInputState {
  readonly selectionActive: boolean;
  readonly benchmarkActive: boolean;
  readonly nativePagerInputReady: boolean;
  /** Whether an earlier direct-tap sheet is still visibly moving. */
  readonly directTapActive: boolean;
}

export interface NativePagerGestureInputPolicy {
  readonly recognizerEnabled: boolean;
  readonly nativeGestureInputEnabled: boolean;
}

export interface PageTurnRecognizerDistances {
  readonly tapMaxDistance: number;
  readonly panActivationDistance: number;
}

const PAGE_TURN_TAP_MAX_DISTANCE_POINTS = 8;

/**
 * Keeps tap jitter and drag activation in disjoint recognition phases.
 *
 * A pan that activates after one physical pixel can win `Gesture.Race` before
 * a tap is allowed to finish, which makes rapid, slightly moving taps vanish
 * on iOS. The pan therefore stays in the possible state for the complete tap
 * tolerance and takes ownership only after the finger has travelled farther.
 */
export function resolvePageTurnRecognizerDistances(
  onePhysicalPixel: number,
): PageTurnRecognizerDistances {
  return {
    tapMaxDistance: PAGE_TURN_TAP_MAX_DISTANCE_POINTS,
    panActivationDistance: Math.max(
      PAGE_TURN_TAP_MAX_DISTANCE_POINTS,
      onePhysicalPixel,
    ),
  };
}

export function resolveNativePagerGestureInputPolicy(
  state: NativePagerGestureInputState,
): NativePagerGestureInputPolicy {
  const recognizerEnabled = !state.selectionActive && !state.benchmarkActive;
  return {
    recognizerEnabled,
    // Direct taps and gestures own separate sheets. A new gesture stays live
    // while earlier tap sheets drain; the compositor must preserve both.
    nativeGestureInputEnabled: recognizerEnabled && state.nativePagerInputReady,
  };
}

/**
 * Binds input to one concrete native canvas for the entire effect lifetime.
 *
 * The canvas ref may point at a replacement by the time React runs cleanup.
 * Capturing the target here prevents an old generation from disabling the
 * newly mounted pager.
 */
export function bindNativePagerInput<Canvas>(
  canvas: Canvas,
  enabled: boolean,
  configure: NativePagerInputConfigurator<Canvas>,
): () => void {
  configure(canvas, enabled);
  return () => {
    configure(canvas, false);
  };
}

/**
 * A native `false` means the compositor did not take ownership of the tap.
 * Fall back on RN for both that case and an unavailable native API.
 */
export function nativePagerTapNeedsRNFallback(
  nativeInputEnabled: boolean,
  nativeResult: boolean | undefined,
): boolean {
  "worklet";
  return !nativeInputEnabled || nativeResult !== true;
}
