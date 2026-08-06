import { LibraryNativeToolbarButton } from "./library-native-toolbar-button";
import type { LibraryBookMenuButtonProps } from "./library-book-menu-button.types";

export function LibraryBookMenuButton({
  accessibilityLabel,
  theme,
  onPress,
}: LibraryBookMenuButtonProps) {
  return (
    <LibraryNativeToolbarButton
      accessibilityLabel={accessibilityLabel}
      compact
      icon="more"
      plain
      theme={theme}
      onPress={onPress}
    />
  );
}

export type { LibraryBookMenuButtonProps } from "./library-book-menu-button.types";
