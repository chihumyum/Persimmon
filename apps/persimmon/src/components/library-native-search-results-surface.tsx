import { FieldGroup, Host } from "@expo/ui";
import { StyleSheet } from "react-native";

import type { LibraryNativeSearchResultsSurfaceProps } from "./library-native-search-results-surface.types";

export function LibraryNativeSearchResultsSurface({
  children,
  theme,
}: LibraryNativeSearchResultsSurfaceProps) {
  return (
    <Host
      colorScheme={theme.colorScheme}
      seedColor={theme.accent}
      style={styles.host}
      useViewportSizeMeasurement
    >
      <FieldGroup style={{ backgroundColor: theme.paper }}>
        <FieldGroup.Section style={{ backgroundColor: theme.paper }}>
          {children}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, width: "100%" },
});
