import { StyleSheet, View } from "react-native";

import { LibraryNativeToolbarButton } from "./library-native-toolbar-button";
import { UiText as Text } from "./ui-text";
import type { LibraryNativeSheetHeaderProps } from "./library-native-sheet-header.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeSheetHeader({
  backAccessibilityLabel,
  closeAccessibilityLabel,
  theme,
  title,
  onBack,
  onClose,
}: LibraryNativeSheetHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <LibraryNativeToolbarButton
            accessibilityLabel={backAccessibilityLabel ?? title}
            icon="back"
            onPress={onBack}
            theme={theme}
          />
        ) : null}
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={styles.side}>
        <LibraryNativeToolbarButton
          accessibilityLabel={closeAccessibilityLabel}
          icon="close"
          onPress={onClose}
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: uiSize.sheetHeader,
    paddingHorizontal: uiSize.optionHorizontalInset,
  },
  side: { alignItems: "center", width: uiSize.control },
  title: { flex: 1, ...uiTypography.sheetHeader, textAlign: "center" },
});
