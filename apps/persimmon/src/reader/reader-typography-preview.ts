import {
  DEFAULT_READER_APPEARANCE,
  type ReaderAppearanceSettings,
} from "../library/types";

export type ReaderTypographyKey =
  | "fontSize"
  | "lineHeight"
  | "paragraphSpacing"
  | "horizontalMargin";

export interface ReaderTypographyControl {
  readonly key: ReaderTypographyKey;
  readonly maximum: number;
  readonly minimum: number;
  readonly step: number;
}

export const READER_TYPOGRAPHY_CONTROLS: readonly ReaderTypographyControl[] = [
  { key: "fontSize", minimum: 16, maximum: 32, step: 1 },
  { key: "lineHeight", minimum: 1.25, maximum: 2.1, step: 0.05 },
  { key: "paragraphSpacing", minimum: 0, maximum: 2, step: 0.1 },
  { key: "horizontalMargin", minimum: 16, maximum: 72, step: 4 },
] as const;

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
