import {
  Button,
  Host,
  HStack,
  Image,
  Text,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  frame,
  foregroundStyle,
  labelStyle,
  padding,
  shapes,
  strokeBorder,
  submitLabel,
  textFieldStyle,
  textInputAutocapitalization,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import type { LibraryNativeSearchFieldProps } from "./library-native-search-field.types";
import { uiRadius, uiSize } from "./ui-tokens";

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
        spacing={0}
        modifiers={[
          frame({ maxWidth: 10_000, minHeight: 58 }),
          padding({ horizontal: 16, vertical: 7 }),
        ]}
      >
        <HStack
          alignment="center"
          spacing={7}
          modifiers={[
            padding({ horizontal: 11 }),
            frame({ maxWidth: 10_000, minHeight: uiSize.minimumHitTarget }),
            background(
              theme.paper,
              shapes.roundedRectangle({
                cornerRadius: uiRadius.control,
                roundedCornerStyle: "continuous",
              }),
            ),
            strokeBorder({
              color: theme.border,
              cornerRadius: uiRadius.control,
              shape: "roundedRectangle",
              style: { lineWidth: 1 },
            }),
          ]}
        >
          <Image
            color={theme.secondaryText}
            size={17}
            systemName="magnifyingglass"
          />
          <TextField
            autoFocus={autoFocus}
            text={text}
            modifiers={[
              accessibilityAddTraits(["isSearchField"]),
              autocorrectionDisabled(),
              foregroundStyle(theme.controlText),
              frame({ maxWidth: 10_000, minHeight: uiSize.minimumHitTarget }),
              submitLabel("search"),
              textFieldStyle("plain"),
              textInputAutocapitalization("never"),
              tint(theme.accent),
            ]}
            onTextChange={onQueryChange}
          >
            <TextField.Placeholder>
              <Text modifiers={[foregroundStyle(theme.secondaryText)]}>
                {placeholder}
              </Text>
            </TextField.Placeholder>
          </TextField>
          {query ? (
            <Button
              label={clearAccessibilityLabel}
              modifiers={[
                buttonStyle("plain"),
                frame({ minHeight: uiSize.minimumHitTarget, minWidth: 28 }),
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
      </HStack>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { height: 58, width: "100%" },
});
