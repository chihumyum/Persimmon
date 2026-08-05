import { DockedSearchBar, Host, Icon, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet } from "react-native";

import searchIcon from "../assets/icons/search.xml";
import type { LibraryNativeSearchFieldProps } from "./library-native-search-field.types";

export function LibraryNativeSearchField({
  placeholder,
  theme,
  onQueryChange,
}: LibraryNativeSearchFieldProps) {
  return (
    <Host
      colorScheme={theme.colorScheme}
      seedColor={theme.accent}
      style={styles.host}
    >
      <DockedSearchBar
        modifiers={[fillMaxWidth(), padding(16, 6, 16, 6)]}
        onQueryChange={onQueryChange}
      >
        <DockedSearchBar.LeadingIcon>
          <Icon
            contentDescription={placeholder}
            size={21}
            source={searchIcon}
            tint={theme.controlText}
          />
        </DockedSearchBar.LeadingIcon>
        <DockedSearchBar.Placeholder>
          <Text color={theme.secondaryText}>{placeholder}</Text>
        </DockedSearchBar.Placeholder>
      </DockedSearchBar>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { height: 64, width: "100%" },
});
