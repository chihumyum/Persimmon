import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, height } from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet } from "react-native";

import type { LibraryNativeFilterControlProps } from "./library-native-filter-control.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeFilterControl({
  options,
  theme,
  value,
  onChange,
}: LibraryNativeFilterControlProps) {
  const colors = {
    activeBorderColor: theme.border,
    activeContainerColor: theme.panelRaised,
    activeContentColor: theme.controlText,
    inactiveBorderColor: theme.border,
    inactiveContainerColor: theme.surrounding,
    inactiveContentColor: theme.controlText,
  };
  return (
    <Host
      colorScheme={theme.colorScheme}
      seedColor={theme.accent}
      style={styles.host}
    >
      <SingleChoiceSegmentedButtonRow
        modifiers={[fillMaxWidth(), height(uiSize.segmentedControl)]}
      >
        {options.map((option) => (
          <SegmentedButton
            colors={colors}
            key={option.value}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <SegmentedButton.Label>
              <Text maxLines={1} style={uiTypography.segmentLabel}>
                {option.label}
              </Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, height: uiSize.segmentedControl, minWidth: 0 },
});
