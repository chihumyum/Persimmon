import type { ColorValue, StyleProp, ViewStyle } from "react-native";

export type UiIconName =
  | "add"
  | "back"
  | "check"
  | "chevronDown"
  | "chevronRight"
  | "close"
  | "cloud"
  | "doubleColumn"
  | "layout"
  | "minus"
  | "more"
  | "reset"
  | "search"
  | "singleColumn"
  | "settings"
  | "sort"
  | "sync"
  | "toc"
  | "tuning"
  | "typography";

export type UiIconWeight = "regular" | "medium" | "semibold";

export interface UiIconProps {
  readonly color: ColorValue;
  readonly name: UiIconName;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly weight?: UiIconWeight;
}
