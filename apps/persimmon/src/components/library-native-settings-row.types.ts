import type { ReaderTheme } from "@persimmon/reader-skia";

export interface LibraryNativeMenuOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

export interface LibraryNativeMenuRowProps<Value extends string> {
  readonly accessibilityLabel: string;
  readonly description?: string;
  readonly options: readonly LibraryNativeMenuOption<Value>[];
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

export interface LibraryNativeSwitchRowProps {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}

export type LibraryNativeActionTone = "accent" | "danger" | "default";

export interface LibraryNativeActionRowProps {
  readonly accessibilityLabel?: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly showsChevron?: boolean;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly tone?: LibraryNativeActionTone;
  readonly value?: string;
  readonly onPress?: () => void;
}
