import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import { height } from "@expo/ui/jetpack-compose/modifiers";
import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import { uiSize, uiTypography } from "./ui-tokens";

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
  const colors = {
    activeBorderColor: theme.border,
    activeContainerColor: theme.panelRaised,
    activeContentColor: theme.controlText,
    inactiveBorderColor: theme.border,
    inactiveContainerColor: theme.panel,
    inactiveContentColor: theme.controlText,
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={styles.container}
    >
      <Host
        colorScheme={theme.colorScheme}
        matchContents={{ vertical: true }}
        seedColor={theme.accent}
        style={styles.host}
      >
        <SingleChoiceSegmentedButtonRow>
          {options.map((option) => (
            <SegmentedButton
              colors={colors}
              key={option.value}
              modifiers={[height(uiSize.segmentedControl)]}
              selected={option.value === value}
              onClick={() => onChange(option.value)}
            >
              <SegmentedButton.Label>
                <Text style={uiTypography.segmentLabel}>{option.label}</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: uiSize.segmentedControl,
    width: "100%",
  },
  host: {
    height: uiSize.segmentedControl,
    width: "100%",
  },
});
