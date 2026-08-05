import {
  Button,
  Host,
  HStack,
  Image,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  frame,
  labelStyle,
  padding,
  textFieldStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import type { LibraryNativeSearchFieldProps } from "./library-native-search-field.types";

export function LibraryNativeSearchField({
  autoFocus = true,
  clearAccessibilityLabel,
  placeholder,
  query,
  theme,
  onQueryChange,
}: LibraryNativeSearchFieldProps) {
  const text = useNativeState(query);
  useEffect(() => {
    if (text.get() !== query) text.set(query);
  }, [query, text]);
  return (
    <Host
      colorScheme={theme.colorScheme}
      ignoreSafeArea="all"
      seedColor={theme.accent}
      style={styles.host}
    >
      <HStack
        alignment="center"
        spacing={8}
        modifiers={[
          frame({ maxWidth: 10_000, minHeight: 58 }),
          padding({ horizontal: 16, vertical: 7 }),
        ]}
      >
        <Image
          color={theme.secondaryText}
          size={17}
          systemName="magnifyingglass"
        />
        <TextField
          autoFocus={autoFocus}
          placeholder={placeholder}
          text={text}
          modifiers={[
            textFieldStyle("roundedBorder"),
            frame({ maxWidth: 10_000, minHeight: 44 }),
          ]}
          onTextChange={onQueryChange}
        />
        {query ? (
          <Button
            label={clearAccessibilityLabel}
            modifiers={[
              buttonStyle("plain"),
              controlSize("large"),
              labelStyle("iconOnly"),
              tint(theme.secondaryText),
              accessibilityLabel(clearAccessibilityLabel),
            ]}
            systemImage="xmark.circle.fill"
            onPress={() => {
              text.set("");
              onQueryChange("");
            }}
          />
        ) : null}
      </HStack>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { height: 58, width: "100%" },
});
