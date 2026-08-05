import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ReaderChromeButton } from "./reader-chrome-button";
import { uiShadow } from "./ui-shadow";
import { uiRadius, uiSize, uiSpace, uiTypography } from "./ui-tokens";

export interface ReaderFloatingPanelProps {
  readonly children: ReactNode;
  readonly theme: ReaderTheme;
  readonly top?: number;
  readonly bottom?: number;
  readonly height?: DimensionValue;
  readonly maxHeight?: DimensionValue;
  readonly maxWidth?: number;
  readonly width?: DimensionValue;
  readonly padding?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function ReaderFloatingPanel({
  bottom,
  children,
  height,
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
          height,
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
  readonly title: string;
  readonly closeAccessibilityLabel: string;
  readonly centerTitle?: boolean;
  readonly theme: ReaderTheme;
  readonly onClose: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function ReaderPanelHeader({
  centerTitle = false,
  closeAccessibilityLabel,
  onClose,
  style,
  theme,
  title,
}: ReaderPanelHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      {centerTitle ? <View style={styles.headerSide} /> : null}
      <View style={[styles.heading, centerTitle && styles.centeredHeading]}>
        <Text
          numberOfLines={centerTitle ? 1 : undefined}
          style={[
            uiTypography.sheetHeader,
            { color: theme.text },
            centerTitle && styles.centeredTitle,
          ]}
        >
          {title}
        </Text>
      </View>
      <ReaderChromeButton
        accessibilityLabel={closeAccessibilityLabel}
        icon="close"
        label={closeAccessibilityLabel}
        onPress={onClose}
        theme={theme}
        tintColor={theme.secondaryText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centeredHeading: {
    flex: 1,
    paddingHorizontal: uiSpace.sm,
  },
  centeredTitle: {
    textAlign: "center",
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: uiSize.sheetHeader,
  },
  headerSide: {
    height: uiSize.control,
    width: uiSize.control,
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
