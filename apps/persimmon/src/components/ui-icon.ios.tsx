import { SymbolView, type SFSymbol, type SymbolWeight } from "expo-symbols";

import type { UiIconName, UiIconProps, UiIconWeight } from "./ui-icon.types";

const IOS_ICON_NAMES = {
  add: "plus",
  back: "chevron.left",
  check: "checkmark",
  chevronDown: "chevron.down",
  chevronRight: "chevron.right",
  close: "xmark",
  cloud: "cloud",
  doubleColumn: "rectangle.split.2x1",
  layout: "rectangle.split.2x1",
  minus: "minus",
  more: "ellipsis",
  reset: "arrow.counterclockwise",
  search: "magnifyingglass",
  singleColumn: "rectangle.portrait",
  settings: "gearshape",
  sort: "arrow.up.arrow.down",
  sync: "arrow.clockwise",
  toc: "list.bullet",
  tuning: "slider.horizontal.3",
  typography: "textformat.size",
} as const satisfies Record<UiIconName, SFSymbol>;

const IOS_WEIGHTS: Record<UiIconWeight, SymbolWeight> = {
  medium: "medium",
  regular: "regular",
  semibold: "semibold",
};

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
      name={IOS_ICON_NAMES[name]}
      pointerEvents="none"
      resizeMode="scaleAspectFit"
      size={size}
      style={style}
      tintColor={color}
      weight={IOS_WEIGHTS[weight]}
    />
  );
}

export type { UiIconName, UiIconProps, UiIconWeight } from "./ui-icon.types";
