import { Column, Host, Icon, Text } from "@expo/ui/jetpack-compose";
import { padding, size } from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet, View } from "react-native";

import cloudIcon from "../assets/icons/cloud.xml";
import type { LibraryNativeEmptyStateProps } from "./library-native-empty-state.types";

export function LibraryNativeEmptyState({
  body,
  style,
  theme,
  title,
}: LibraryNativeEmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Host
        colorScheme={theme.colorScheme}
        seedColor={theme.accent}
        style={styles.host}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 10 }}
          modifiers={[padding(24, 34, 24, 34)]}
        >
          <Icon
            contentDescription={undefined}
            size={42}
            source={cloudIcon}
            tint={theme.secondaryText}
            modifiers={[size(42, 42)]}
          />
          <Text
            color={theme.text}
            style={{ fontSize: 20, fontWeight: "600", textAlign: "center" }}
          >
            {title}
          </Text>
          <Text
            color={theme.secondaryText}
            style={{ fontSize: 14, textAlign: "center" }}
          >
            {body}
          </Text>
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 220, width: "100%" },
  host: { height: 220, width: "100%" },
});
