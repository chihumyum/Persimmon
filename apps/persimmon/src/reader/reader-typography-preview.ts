import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
} from "../library/types";
import {
  READER_TYPOGRAPHY_CONTROLS,
  type ReaderTypographyControl,
  type ReaderTypographyKey,
} from "../library/reader-typography-controls";

export {
  READER_TYPOGRAPHY_CONTROLS,
  type ReaderTypographyControl,
  type ReaderTypographyKey,
} from "../library/reader-typography-controls";

const TYPOGRAPHY_KEYS = READER_TYPOGRAPHY_CONTROLS.map(
  (control) => control.key,
);

function decimalPlaces(value: number): number {
  const decimal = value.toString().split(".")[1];
  return decimal?.length ?? 0;
}

export function readerTypographyValues(
  control: ReaderTypographyControl,
): readonly number[] {
  const precision = decimalPlaces(control.step);
  const count = Math.round((control.maximum - control.minimum) / control.step);
  return Array.from({ length: count + 1 }, (_, index) =>
    Number((control.minimum + index * control.step).toFixed(precision)),
  );
}

export function updateReaderTypography(
  current: ReaderAppearanceSettings,
  key: ReaderTypographyKey,
  value: number,
): ReaderAppearanceSettings {
  return { ...current, [key]: value };
}

export function resetReaderTypography(
  current: ReaderAppearanceSettings,
): ReaderAppearanceSettings {
  return TYPOGRAPHY_KEYS.reduce<ReaderAppearanceSettings>(
    (next, key) => ({ ...next, [key]: DEFAULT_READER_APPEARANCE[key] }),
    current,
  );
}

export function readerTypographyEquals(
  left: ReaderAppearanceSettings,
  right: ReaderAppearanceSettings,
): boolean {
  return TYPOGRAPHY_KEYS.every((key) => left[key] === right[key]);
}
