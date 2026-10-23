import BottomSheet, {
  type BottomSheetMethods,
} from "@expo/ui/community/bottom-sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDuoLayout } from "../../modules/persimmon-duo-layout";
import { useAppStatusBarHidden } from "../../modules/persimmon-status-bar";
import { readerSystemColumn } from "../reader/reader-chrome-layout";
import type { ReaderBottomSheetProps } from "./reader-bottom-sheet.types";
import { clampSheetSnapPoints } from "./sheet-snap-points";
import { systemColumnOcclusionBottom } from "./system-column";
import { uiBreakpoint, uiSize, uiSpace } from "./ui-tokens";

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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const duoLayout = useDuoLayout();
  // The sheet keeps the status bar the way the screen under it has it, so a
  // reader sheet leaves it hidden and only has to clear the camera.
  const statusBarHidden = useAppStatusBarHidden();
  // A compact window with a system column (the iPhone Duo outer display)
  // stops its sheets below the camera, and below the status bar too when the
  // screen shows it, so their rows and close button can run through the
  // column the way they do on every other iPhone.
  const column =
    Platform.OS === "ios" && windowWidth < uiBreakpoint.compact
      ? readerSystemColumn(insets, uiSize.control)
      : undefined;
  const columnOcclusionBottom = column
    ? systemColumnOcclusionBottom(
        statusBarHidden ? duoLayout.occlusions : duoLayout.peakOcclusions,
        windowWidth,
        column.side,
        column.width,
      )
    : 0;
  const maximumSheetHeight = windowHeight - columnOcclusionBottom - uiSpace.xl;
  const sheetSnapPoints = useMemo(
    () =>
      columnOcclusionBottom > 0
        ? clampSheetSnapPoints(snapPoints, windowHeight, maximumSheetHeight)
        : snapPoints,
    [columnOcclusionBottom, maximumSheetHeight, snapPoints, windowHeight],
  );
  // The keyboard slides a sheet up, back into the camera and status bar.
  // While it is pushed there, the content steps back beside the column so
  // the header and close button stay reachable.
  const [contentHeight, setContentHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number>();
  useEffect(() => {
    if (columnOcclusionBottom <= 0) {
      return;
    }
    const shown = Keyboard.addListener("keyboardWillShow", (event) =>
      setKeyboardTop(event.endCoordinates.screenY),
    );
    const hidden = Keyboard.addListener("keyboardWillHide", () =>
      setKeyboardTop(undefined),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [columnOcclusionBottom]);
  const raisedIntoColumn =
    keyboardTop !== undefined &&
    keyboardTop - contentHeight < columnOcclusionBottom;
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
      ignoresHorizontalSafeArea={columnOcclusionBottom > 0}
      statusBarHidden={statusBarHidden}
      index={-1}
      snapPoints={contentSizedOnAndroid ? undefined : sheetSnapPoints}
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
        style={[
          androidHeight === undefined
            ? styles.content
            : { height: androidHeight },
          column &&
            raisedIntoColumn &&
            (column.side === "left"
              ? { paddingLeft: column.width }
              : { paddingRight: column.width }),
        ]}
        testID={testID}
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
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
