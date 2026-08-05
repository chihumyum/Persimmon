import BottomSheet, {
  type BottomSheetMethods,
} from "@expo/ui/community/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

import type { ReaderBottomSheetProps } from "./reader-bottom-sheet.types";

/**
 * Keeps the app-facing Reader UI independent from the native sheet provider.
 * @expo/ui presents SwiftUI Sheet on iOS and Material 3 ModalBottomSheet on
 * Android while letting the existing React Native content remain shared.
 */
export function ReaderBottomSheet({
  allowsUserResizing = true,
  androidHeightRatio,
  children,
  dismissible = true,
  expanded = false,
  snapIndex,
  snapPoints,
  testID,
  theme,
  visible,
  onDismiss,
}: ReaderBottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheetMethods>(null);
  const visibleRef = useRef(visible);
  const closingForVisibilityRef = useRef(false);
  visibleRef.current = visible;
  const [mounted, setMounted] = useState(visible);
  // Material 3's native ModalBottomSheet only has partial (~50%) and full
  // states when snap points are supplied. Reader settings instead use a
  // content-sized native sheet on Android so the taller secondary page can
  // never expand to full screen while remaining swipe-dismissible.
  const contentSizedOnAndroid =
    Platform.OS === "android" && androidHeightRatio !== undefined;
  const requestedIndex = contentSizedOnAndroid
    ? 0
    : (snapIndex ?? (expanded ? snapPoints.length - 1 : 0));
  const targetIndex = requestedIndex;
  const androidHeight = contentSizedOnAndroid
    ? Math.round(windowHeight * androidHeightRatio)
    : undefined;

  useEffect(() => {
    if (visible && !mounted) {
      setMounted(true);
      return;
    }
    if (!mounted) {
      return;
    }
    if (visible) {
      const frame = requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(targetIndex);
      });
      return () => cancelAnimationFrame(frame);
    }
    closingForVisibilityRef.current = true;
    sheetRef.current?.close();
  }, [mounted, targetIndex, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      backgroundStyle={{ backgroundColor: theme.panel }}
      enableContentPanningGesture={allowsUserResizing}
      enableDynamicSizing={contentSizedOnAndroid}
      enableHandlePanningGesture={allowsUserResizing}
      enablePanDownToClose={dismissible && allowsUserResizing}
      handleComponent={null}
      index={-1}
      snapPoints={contentSizedOnAndroid ? undefined : snapPoints}
      onClose={() => {
        if (closingForVisibilityRef.current && visibleRef.current) {
          closingForVisibilityRef.current = false;
          requestAnimationFrame(() => {
            sheetRef.current?.snapToIndex(targetIndex);
          });
          return;
        }
        closingForVisibilityRef.current = false;
        setMounted(false);
        onDismiss();
      }}
    >
      <View
        style={
          androidHeight === undefined
            ? styles.content
            : { height: androidHeight }
        }
        testID={testID}
      >
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
