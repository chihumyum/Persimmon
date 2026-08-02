export const READER_SLIDER_THUMB_SIZE = 16;

export interface ReaderSliderTrackMetrics {
  readonly left: number;
  readonly width: number;
}

export function readerSliderTrackMetrics(
  frameLeft: number,
  frameWidth: number,
  thumbSize = READER_SLIDER_THUMB_SIZE,
): ReaderSliderTrackMetrics {
  const inset = Math.max(0, thumbSize) / 2;
  return {
    left: frameLeft + inset,
    width: Math.max(1, frameWidth - inset * 2),
  };
}

export function quantizeReaderSliderValue(
  candidate: number,
  minimum: number,
  maximum: number,
  step: number,
): number {
  const stepCount = Math.round((candidate - minimum) / step);
  return Number(
    Math.min(maximum, Math.max(minimum, minimum + stepCount * step)).toFixed(3),
  );
}

export function readerSliderValueAtPageX(
  pageX: number,
  track: ReaderSliderTrackMetrics,
  minimum: number,
  maximum: number,
  step: number,
): number {
  const ratio = readerSliderRatioAtPageX(pageX, track);
  return quantizeReaderSliderValue(
    minimum + ratio * (maximum - minimum),
    minimum,
    maximum,
    step,
  );
}

export function readerSliderRatioAtPageX(
  pageX: number,
  track: ReaderSliderTrackMetrics,
): number {
  return Math.min(1, Math.max(0, (pageX - track.left) / track.width));
}

export function stepReaderSliderValue(
  value: number,
  direction: 1 | -1,
  minimum: number,
  maximum: number,
  step: number,
): number {
  return quantizeReaderSliderValue(
    value + direction * step,
    minimum,
    maximum,
    step,
  );
}
