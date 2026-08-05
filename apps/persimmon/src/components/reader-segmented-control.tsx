import SegmentedControl from "@expo/ui/community/segmented-control";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import { uiSize } from "./ui-tokens";

export interface ReaderSegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

interface ReaderSegmentedControlProps<Value extends string> {
  readonly accessibilityLabel: string;
  readonly options: readonly ReaderSegmentedOption<Value>[];
  readonly theme: ReaderTheme;
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

export function ReaderSegmentedControl<Value extends string>({
  accessibilityLabel,
  options,
  theme,
  value,
  onChange,
}: ReaderSegmentedControlProps<Value>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={styles.container}
    >
      <SegmentedControl
        appearance={theme.colorScheme}
        selectedIndex={selectedIndex}
        style={styles.control}
        tintColor={theme.panel}
        values={options.map((option) => option.label)}
        onChange={({ nativeEvent }) => {
          const next = options[nativeEvent.selectedSegmentIndex];
          if (next) {
            onChange(next.value);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: uiSize.segmentedControl,
    width: "100%",
  },
  control: {
    minHeight: uiSize.segmentedControl,
    width: "100%",
  },
});
