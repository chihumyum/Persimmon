import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { LibraryNativeToolbarButton } from "./library-native-toolbar-button";
import { UiText as Text } from "./ui-text";
import type { LibraryNativeSortControlProps } from "./library-native-sort-control.types";
import { uiSize } from "./ui-tokens";

export function LibraryNativeSortControl({
  accessibilityLabel,
  options,
  theme,
  value,
  onChange,
}: LibraryNativeSortControlProps) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <LibraryNativeToolbarButton
        accessibilityLabel={accessibilityLabel}
        icon="sort"
        onPress={() => setVisible(true)}
        theme={theme}
      />
      <Modal
        transparent
        visible={visible}
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={[styles.menu, { backgroundColor: theme.panelRaised }]}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setVisible(false);
                }}
                style={styles.row}
              >
                <Text style={{ color: theme.controlText }}>
                  {option.value === value ? `✓  ${option.label}` : option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", flex: 1, justifyContent: "center" },
  menu: { borderRadius: 18, minWidth: 220, padding: 8 },
  row: {
    justifyContent: "center",
    minHeight: uiSize.control,
    paddingHorizontal: 14,
  },
});

export type { LibraryNativeSortControlProps } from "./library-native-sort-control.types";
