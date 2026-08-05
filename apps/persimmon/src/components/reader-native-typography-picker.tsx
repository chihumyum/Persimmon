import { requireNativeView } from "expo";
import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ComponentType } from "react";
import {
  Platform,
  Pressable,
  processColor,
  StyleSheet,
  type NativeSyntheticEvent,
  type ViewProps,
  View,
} from "react-native";

import { UiText as Text } from "./ui-text";
import { uiTypography } from "./ui-tokens";

interface NativeReaderTypographyPickerProps extends ViewProps {
  readonly fontSizeValues: readonly string[];
  readonly horizontalMarginValues: readonly string[];
  readonly labelColor: ReturnType<typeof processColor>;
  readonly labelFontSize: number;
  readonly labels: readonly string[];
  readonly lineHeightValues: readonly string[];
  readonly paragraphSpacingValues: readonly string[];
  readonly selectedIndices: readonly number[];
  readonly textColor: ReturnType<typeof processColor>;
  readonly onValueChange?: (
    event: NativeSyntheticEvent<{
      readonly component: number;
      readonly index: number;
    }>,
  ) => void;
}

const NativeReaderTypographyPickerView: ComponentType<NativeReaderTypographyPickerProps> | null =
  Platform.OS === "web"
    ? null
    : requireNativeView<NativeReaderTypographyPickerProps>(
        "PersimmonSelectionMenu",
        "PersimmonReaderTypographyPickerView",
      );

interface ReaderNativeTypographyPickerProps {
  readonly accessibilityLabels: readonly string[];
  readonly columns: readonly (readonly string[])[];
  readonly selectedIndices: readonly number[];
  readonly theme: ReaderTheme;
  readonly onChange: (component: number, index: number) => void;
}

export function ReaderNativeTypographyPicker({
  accessibilityLabels,
  columns,
  selectedIndices,
  theme,
  onChange,
}: ReaderNativeTypographyPickerProps) {
  if (!NativeReaderTypographyPickerView) {
    return (
      <View style={styles.fallbackRow}>
        {columns.map((values, component) => {
          const selectedIndex = selectedIndices[component] ?? 0;
          return (
            <Pressable
              accessibilityLabel={accessibilityLabels[component]}
              accessibilityRole="adjustable"
              key={accessibilityLabels[component] ?? component}
              onPress={() =>
                onChange(component, (selectedIndex + 1) % values.length)
              }
              style={styles.fallbackColumn}
            >
              <Text style={{ color: theme.controlText }}>
                {values[selectedIndex]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <NativeReaderTypographyPickerView
      accessibilityLabel={accessibilityLabels.join(", ")}
      accessibilityRole="adjustable"
      fontSizeValues={columns[0] ?? []}
      horizontalMarginValues={columns[3] ?? []}
      lineHeightValues={columns[1] ?? []}
      labelColor={processColor(theme.secondaryText)}
      labelFontSize={uiTypography.optionLabel.fontSize}
      labels={accessibilityLabels}
      paragraphSpacingValues={columns[2] ?? []}
      selectedIndices={selectedIndices}
      style={styles.native}
      textColor={processColor(theme.controlText)}
      onValueChange={({ nativeEvent }) =>
        onChange(nativeEvent.component, nativeEvent.index)
      }
    />
  );
}

const styles = StyleSheet.create({
  fallbackColumn: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  fallbackRow: {
    flex: 1,
    flexDirection: "row",
  },
  native: {
    height: 210,
    width: "100%",
  },
});
