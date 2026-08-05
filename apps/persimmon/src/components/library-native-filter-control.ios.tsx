import { requireNativeView } from "expo";
import type { ComponentType } from "react";
import {
  processColor,
  StyleSheet,
  type NativeSyntheticEvent,
  type ViewProps,
  View,
} from "react-native";

import type { LibraryNativeFilterControlProps } from "./library-native-filter-control.types";
import { uiSize, uiTypography } from "./ui-tokens";

interface NativeLibraryFilterControlProps extends ViewProps {
  readonly fontSize: number;
  readonly options: readonly string[];
  readonly selectedBackgroundColor: ReturnType<typeof processColor>;
  readonly selectedIndex: number;
  readonly selectedTextColor: ReturnType<typeof processColor>;
  readonly textColor: ReturnType<typeof processColor>;
  readonly unselectedBackgroundColor: ReturnType<typeof processColor>;
  readonly onValueChange?: (
    event: NativeSyntheticEvent<{ readonly index: number }>,
  ) => void;
}

const NativeLibraryFilterControlView: ComponentType<NativeLibraryFilterControlProps> =
  requireNativeView<NativeLibraryFilterControlProps>(
    "PersimmonSelectionMenu",
    "PersimmonReaderSegmentedControlView",
  );

export function LibraryNativeFilterControl({
  accessibilityLabel: controlAccessibilityLabel,
  options,
  theme,
  value,
  onChange,
}: LibraryNativeFilterControlProps) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <View
      accessibilityLabel={controlAccessibilityLabel}
      accessibilityRole="radiogroup"
      style={styles.host}
    >
      <NativeLibraryFilterControlView
        fontSize={uiTypography.segmentLabel.fontSize}
        options={options.map((option) => option.label)}
        selectedBackgroundColor={processColor(theme.panelRaised)}
        selectedIndex={selectedIndex}
        selectedTextColor={processColor(theme.text)}
        style={styles.control}
        textColor={processColor(theme.text)}
        unselectedBackgroundColor={processColor(theme.surrounding)}
        onValueChange={({ nativeEvent }) => {
          const selected = options[nativeEvent.index];
          if (selected) {
            onChange(selected.value);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  control: { height: uiSize.segmentedControl, width: "100%" },
  host: { flex: 1, height: uiSize.segmentedControl, minWidth: 0 },
});
