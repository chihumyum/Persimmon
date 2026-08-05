import { Pressable, ScrollView, StyleSheet } from "react-native";

import { UiText as Text } from "./ui-text";
import type { LibraryNativeFilterControlProps } from "./library-native-filter-control.types";
import { uiRadius, uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeFilterControl({
  options,
  theme,
  value,
  onChange,
}: LibraryNativeFilterControlProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.host, { backgroundColor: theme.panelMuted }]}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              selected && { backgroundColor: theme.panelRaised },
            ]}
          >
            <Text
              style={[uiTypography.segmentLabel, { color: theme.controlText }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 3 },
  host: {
    borderRadius: uiRadius.pill,
    flex: 1,
    height: uiSize.segmentedControl,
  },
  option: {
    borderRadius: 10,
    justifyContent: "center",
    minHeight: uiSize.segmentedControl - 6,
    paddingHorizontal: 12,
  },
});

export type { LibraryNativeFilterControlProps } from "./library-native-filter-control.types";
