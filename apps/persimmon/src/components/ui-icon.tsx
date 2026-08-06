import { SymbolView, type AndroidSymbol } from "expo-symbols";

import type { UiIconName, UiIconProps } from "./ui-icon.types";

const MATERIAL_ICON_NAMES = {
  add: "add",
  back: "arrow_back",
  check: "check",
  chevronDown: "keyboard_arrow_down",
  chevronRight: "chevron_right",
  close: "close",
  cloud: "cloud",
  doubleColumn: "view_column",
  layout: "view_column",
  minus: "remove",
  more: "more_horiz",
  reset: "refresh",
  search: "search",
  singleColumn: "crop_portrait",
  settings: "settings",
  sort: "sort",
  sync: "sync",
  toc: "list",
  tuning: "tune",
  typography: "format_size",
} as const satisfies Record<UiIconName, AndroidSymbol>;

export function UiIcon({
  color,
  name,
  size = 20,
  style,
  weight = "medium",
}: UiIconProps) {
  return (
    <SymbolView
      accessibilityElementsHidden
      importantForAccessibility="no"
      name={{
        android: MATERIAL_ICON_NAMES[name],
      }}
      pointerEvents="none"
      resizeMode="scaleAspectFit"
      size={size}
      style={style}
      tintColor={color}
      weight={weight}
    />
  );
}

export type { UiIconName, UiIconProps, UiIconWeight } from "./ui-icon.types";
