import type { ReaderTheme } from "@persimmon/reader-skia";
import { requireNativeView } from "expo";
import type { ComponentType } from "react";
import {
  processColor,
  StyleSheet,
  type NativeSyntheticEvent,
  type ViewProps,
  View,
} from "react-native";
import { uiSize, uiTypography } from "./ui-tokens";

export interface ReaderSegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

interface NativeReaderSegmentedControlProps extends ViewProps {
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

const NativeReaderSegmentedControlView: ComponentType<NativeReaderSegmentedControlProps> =
  requireNativeView<NativeReaderSegmentedControlProps>(
    "PersimmonSelectionMenu",
    "PersimmonReaderSegmentedControlView",
  );

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
      <NativeReaderSegmentedControlView
        fontSize={uiTypography.segmentLabel.fontSize}
        options={options.map((option) => option.label)}
        selectedBackgroundColor={processColor(theme.panelRaised)}
        selectedIndex={selectedIndex}
        selectedTextColor={processColor(theme.text)}
        style={styles.control}
        textColor={processColor(theme.text)}
        unselectedBackgroundColor={processColor(theme.panel)}
        onValueChange={({ nativeEvent }) => {
          const next = options[nativeEvent.index];
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
    height: uiSize.segmentedControl,
    width: "100%",
  },
  control: {
    height: uiSize.segmentedControl,
    width: "100%",
  },
});
