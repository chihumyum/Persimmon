import type { ReaderTheme } from "@persimmon/reader-skia";

export type ReaderSettingsActionTone = "accent" | "danger" | "default";

export interface ReaderSettingsActionRowProps {
  readonly accessibilityLabel?: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly showsChevron?: boolean;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly tone?: ReaderSettingsActionTone;
  readonly value?: string;
  readonly wrapsValue?: boolean;
  readonly onPress?: () => void;
}
