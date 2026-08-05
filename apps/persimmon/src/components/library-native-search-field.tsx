import { StyleSheet, TextInput } from "react-native";

import type { LibraryNativeSearchFieldProps } from "./library-native-search-field.types";

export function LibraryNativeSearchField({
  autoFocus,
  placeholder,
  query,
  theme,
  onQueryChange,
}: LibraryNativeSearchFieldProps) {
  return (
    <TextInput
      autoFocus={autoFocus}
      onChangeText={onQueryChange}
      placeholder={placeholder}
      placeholderTextColor={theme.secondaryText}
      style={[
        styles.input,
        { backgroundColor: theme.panelRaised, color: theme.controlText },
      ]}
      value={query}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 14,
    fontSize: 16,
    height: 48,
    marginHorizontal: 16,
    paddingHorizontal: 14,
  },
});

export type { LibraryNativeSearchFieldProps } from "./library-native-search-field.types";
