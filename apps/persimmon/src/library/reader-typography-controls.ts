export const READER_TYPOGRAPHY_RANGES = {
  fontSize: { minimum: 12, maximum: 48, step: 1 },
  lineHeight: { minimum: 1, maximum: 3, step: 0.05 },
  paragraphSpacing: { minimum: 0, maximum: 4, step: 0.1 },
  horizontalMargin: { minimum: 0, maximum: 320, step: 4 },
} as const;

export type ReaderTypographyKey = keyof typeof READER_TYPOGRAPHY_RANGES;

export interface ReaderTypographyControl {
  readonly key: ReaderTypographyKey;
  readonly maximum: number;
  readonly minimum: number;
  readonly step: number;
}

export const READER_TYPOGRAPHY_CONTROLS: readonly ReaderTypographyControl[] = [
  { key: "fontSize", ...READER_TYPOGRAPHY_RANGES.fontSize },
  { key: "lineHeight", ...READER_TYPOGRAPHY_RANGES.lineHeight },
  { key: "paragraphSpacing", ...READER_TYPOGRAPHY_RANGES.paragraphSpacing },
  { key: "horizontalMargin", ...READER_TYPOGRAPHY_RANGES.horizontalMargin },
] as const;
