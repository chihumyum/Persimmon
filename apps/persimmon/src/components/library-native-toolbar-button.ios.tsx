import { AppRoundButton } from "./app-round-button";
import type { LibraryNativeToolbarButtonProps } from "./library-native-toolbar-button.types";

export function LibraryNativeToolbarButton({
  compact = false,
  plain = false,
  theme,
  tintColor,
  ...props
}: LibraryNativeToolbarButtonProps) {
  return (
    <AppRoundButton
      {...props}
      icon={props.icon}
      size={compact ? "compact" : "control"}
      surface={plain ? "plain" : "glass"}
      theme={theme}
      tintColor={tintColor}
    />
  );
}

export type { LibraryNativeToolbarButtonProps } from "./library-native-toolbar-button.types";
