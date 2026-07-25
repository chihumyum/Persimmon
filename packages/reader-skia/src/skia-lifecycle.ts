/**
 * RN Skia's declarative Canvas can replay the previous display list after a
 * React subtree unmounts. Keep JSI-backed objects alive for two paint
 * opportunities so that display list can release its native pointers first.
 */
export function afterSkiaPaint(callback: () => void): void {
  let paintedFrames = 0;
  const defer = (next: () => void) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(next);
      return;
    }
    setTimeout(next, 32);
  };
  const runAfterRelease = () => {
    paintedFrames += 1;
    if (paintedFrames < 2) {
      defer(runAfterRelease);
      return;
    }
    callback();
  };
  defer(runAfterRelease);
}
