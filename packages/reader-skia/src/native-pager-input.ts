export type NativePagerInputConfigurator<Canvas> = (
  canvas: Canvas,
  enabled: boolean,
) => unknown;

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
