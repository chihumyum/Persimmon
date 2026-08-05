import { ContentUnavailableView, Host } from "@expo/ui/swift-ui";
import { frame, tint } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

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
        ignoreSafeArea="all"
        seedColor={theme.accent}
        style={styles.host}
      >
        <ContentUnavailableView
          description={body}
          systemImage="books.vertical"
          title={title}
          modifiers={[
            frame({ maxWidth: 10_000, minHeight: 220 }),
            tint(theme.accentStrong),
          ]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 220, width: "100%" },
  host: { height: 220, width: "100%" },
});
