import { useCallback, useRef } from "react";

/**
 * Keeps the function identity captured by a UI worklet stable while still
 * dispatching to the latest React callback on the RN runtime.
 *
 * Worklets stores scheduled RN functions in a remote-function registry. If a
 * render replaces a captured callback while an older gesture worklet is still
 * finishing, that registry entry can disappear before scheduleOnRN resolves
 * it. The stable outer function prevents that lifecycle race.
 */
export function useStableRNDispatcher<Arguments extends unknown[], Result>(
  callback: (...args: Arguments) => Result,
): (...args: Arguments) => Result {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Arguments) => callbackRef.current(...args), []);
}
