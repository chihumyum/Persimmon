import {
  buttonBorderShape,
  buttonStyle,
  font,
  frame,
  glassEffect,
} from "@expo/ui/swift-ui/modifiers";
import { Platform } from "react-native";

const supportsLiquidGlass = Number.parseFloat(String(Platform.Version)) >= 26;

export function iosNativeRoundControlModifiers({
  dimension,
  iconSize,
  surface,
}: {
  readonly dimension: number;
  readonly iconSize: number;
  readonly surface: "glass" | "plain";
}) {
  return [
    font({ size: iconSize, weight: "medium" }),
    frame({ width: dimension, height: dimension }),
    buttonStyle(
      surface === "plain" || supportsLiquidGlass ? "plain" : "bordered",
    ),
    ...(surface === "glass" && supportsLiquidGlass
      ? [
          glassEffect({
            glass: { interactive: true, variant: "regular" },
            shape: "circle",
          }),
        ]
      : surface === "glass"
        ? [buttonBorderShape("circle")]
        : []),
  ];
}
