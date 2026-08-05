import type { ReaderTheme } from "@persimmon/reader-skia";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ReaderBottomSheet } from "./reader-bottom-sheet";
import { LibraryNativeSheetHeader } from "./library-native-sheet-header";

interface LibraryNativeSheetProps {
  readonly backAccessibilityLabel?: string;
  readonly children: ReactNode;
  readonly closeAccessibilityLabel: string;
  readonly heightRatio?: number;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly visible: boolean;
  readonly onBack?: () => void;
  readonly onClose: () => void;
}

export function LibraryNativeSheet({
  backAccessibilityLabel,
  children,
  closeAccessibilityLabel,
  heightRatio = 0.72,
  theme,
  title,
  visible,
  onBack,
  onClose,
}: LibraryNativeSheetProps) {
  return (
    <ReaderBottomSheet
      androidHeightRatio={heightRatio}
      snapPoints={[`${Math.round(heightRatio * 100)}%`]}
      theme={theme}
      visible={visible}
      onDismiss={onClose}
    >
      <View style={[styles.surface, { backgroundColor: theme.panel }]}>
        <LibraryNativeSheetHeader
          backAccessibilityLabel={backAccessibilityLabel}
          closeAccessibilityLabel={closeAccessibilityLabel}
          theme={theme}
          title={title}
          onBack={onBack}
          onClose={onClose}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </ReaderBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  surface: { flex: 1, overflow: "hidden" },
});
