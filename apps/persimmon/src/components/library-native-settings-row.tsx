import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { UiText as Text } from "./ui-text";
import type {
  LibraryNativeActionRowProps,
  LibraryNativeMenuRowProps,
  LibraryNativeSwitchRowProps,
} from "./library-native-settings-row.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeMenuRow<Value extends string>({
  options,
  theme,
  title,
  value,
  onChange,
}: LibraryNativeMenuRowProps<Value>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const next = options[(index + 1) % options.length];
  return (
    <Pressable onPress={() => next && onChange(next.value)} style={styles.row}>
      <Text style={[styles.title, { color: theme.controlText }]}>{title}</Text>
      <Text style={styles.value}>{options[index]?.label ?? value}</Text>
    </Pressable>
  );
}

export function LibraryNativeSwitchRow({
  theme,
  title,
  value,
  onChange,
}: LibraryNativeSwitchRowProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.controlText }]}>{title}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export function LibraryNativeActionRow({
  disabled,
  loading,
  theme,
  title,
  value,
  onPress,
}: LibraryNativeActionRowProps) {
  const content = (
    <>
      <Text style={[styles.title, { color: theme.controlText }]}>{title}</Text>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.value}>{value}</Text>
      )}
    </>
  );
  return onPress ? (
    <Pressable disabled={disabled} onPress={onPress} style={styles.row}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: uiSize.optionRow,
  },
  title: { flex: 1, ...uiTypography.optionLabel },
  value: { color: "#777", ...uiTypography.optionValue },
});

export type {
  LibraryNativeActionRowProps,
  LibraryNativeMenuOption,
  LibraryNativeMenuRowProps,
  LibraryNativeSwitchRowProps,
} from "./library-native-settings-row.types";
