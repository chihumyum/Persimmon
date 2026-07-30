import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { UiButton } from "./ui-button";
import { UiText } from "./ui-text";
import { uiShadow } from "./ui-shadow";
import { uiRadius, uiSpace } from "./ui-tokens";

export interface ReaderFloatingPanelProps {
  readonly children: ReactNode;
  readonly theme: ReaderTheme;
  readonly top?: number;
  readonly bottom?: number;
  readonly maxHeight?: DimensionValue;
  readonly maxWidth?: number;
  readonly width?: DimensionValue;
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function ReaderFloatingPanel({
  bottom,
  children,
  maxHeight = "84%",
  maxWidth = 360,
  padding = uiSpace.lg,
  style,
  theme,
  top,
  width = "88%",
}: ReaderFloatingPanelProps) {
  return (
    <View
      style={[
        styles.panel,
        uiShadow(theme, "floating"),
        {
          backgroundColor: theme.panel,
          borderColor: theme.border,
          bottom,
          maxHeight,
          maxWidth,
          padding,
          top,
          width,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface ReaderPanelHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly closeAccessibilityLabel: string;
  readonly theme: ReaderTheme;
  readonly onClose: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function ReaderPanelHeader({
  closeAccessibilityLabel,
  eyebrow,
  onClose,
  style,
  theme,
  title,
}: ReaderPanelHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.heading}>
        {eyebrow ? (
          <UiText variant="eyebrow" style={{ color: theme.accentStrong }}>
            {eyebrow}
          </UiText>
        ) : null}
        <UiText variant="panelTitle" style={{ color: theme.text }}>
          {title}
        </UiText>
      </View>
      <UiButton
        accessibilityLabel={closeAccessibilityLabel}
        compact
        iconOnly
        label={closeAccessibilityLabel}
        leadingIcon="close"
        onPress={onClose}
        textTone="muted"
        theme={theme}
        variant="ghost"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    flexShrink: 1,
    gap: uiSpace.xxs,
  },
  panel: {
    borderRadius: uiRadius.panel,
    borderWidth: StyleSheet.hairlineWidth,
    position: "absolute",
    right: Platform.OS === "web" ? 30 : uiSpace.md,
    zIndex: 26,
  },
});
