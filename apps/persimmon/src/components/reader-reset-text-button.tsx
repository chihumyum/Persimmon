import { UiButton } from "./ui-button";
import type { ReaderResetTextButtonProps } from "./reader-reset-text-button.types";

export function ReaderResetTextButton({
  accessibilityLabel,
  label,
  style,
  theme,
  onPress,
}: ReaderResetTextButtonProps) {
  return (
    <UiButton
      accessibilityLabel={accessibilityLabel}
      label={label}
      onPress={onPress}
      style={style}
      textTone="accent"
      theme={theme}
      variant="ghost"
    />
  );
}

export type { ReaderResetTextButtonProps } from "./reader-reset-text-button.types";
