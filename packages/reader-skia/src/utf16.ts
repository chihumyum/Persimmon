export type Utf16BoundaryAffinity = "backward" | "forward";

/**
 * SkParagraph exposes UTF-16 offsets, just like JavaScript strings and BookIR.
 * Hit testing can still land inside a surrogate pair, so public offsets are
 * snapped to a Unicode scalar boundary before leaving the renderer.
 */
export function normalizeUtf16Boundary(
  text: string,
  offset: number,
  affinity: Utf16BoundaryAffinity = "backward",
): number {
  const clamped = Math.min(text.length, Math.max(0, Math.trunc(offset)));
  if (clamped === 0 || clamped === text.length) {
    return clamped;
  }

  const previous = text.charCodeAt(clamped - 1);
  const next = text.charCodeAt(clamped);
  const splitsSurrogatePair =
    previous >= 0xd800 &&
    previous <= 0xdbff &&
    next >= 0xdc00 &&
    next <= 0xdfff;

  if (!splitsSurrogatePair) {
    return clamped;
  }
  return affinity === "forward" ? clamped + 1 : clamped - 1;
}
