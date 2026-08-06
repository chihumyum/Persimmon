import {
  Host,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  RNHostView,
} from "@expo/ui/jetpack-compose";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ReaderBottomSheetProps } from "./reader-bottom-sheet.types";

const SHEET_RESIZE_DURATION_MS = 240;
// Material 3's ModalBottomSheet uses BottomSheetDefaults.SheetMaxWidth.
// Matching that constraint keeps the hosted RN tree from measuring to the
// full tablet window and being clipped by the native sheet surface.
const ANDROID_SHEET_MAX_WIDTH = 640;

function resolveSnapHeight(
  snapPoint: number | string,
  windowHeight: number,
): number | undefined {
  if (typeof snapPoint === "number") {
    return snapPoint;
  }
  if (!snapPoint.endsWith("%")) {
    return undefined;
  }
  const percentage = Number.parseFloat(snapPoint.slice(0, -1));
  return Number.isFinite(percentage)
    ? Math.round((windowHeight * percentage) / 100)
    : undefined;
}

/**
 * Keeps one Material 3 sheet mounted while Reader subpages change. Compose's
 * ModalBottomSheet re-anchors when its measured content height changes, so the
 * native host stays at the largest configured height while only the visible
 * paper surface animates from the bottom edge.
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
  onBackPress,
  onDismiss,
}: ReaderBottomSheetProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const visibleRef = useRef(visible);
  const onDismissRef = useRef(onDismiss);
  const dismissReportedRef = useRef(!visible);
  const hideGenerationRef = useRef(0);
  const [mounted, setMounted] = useState(visible);

  visibleRef.current = visible;
  onDismissRef.current = onDismiss;

  const contentSized = androidHeightRatio !== undefined;
  const hasMultipleSnapPoints = !contentSized && snapPoints.length > 1;
  const maxIndex = Math.max(0, snapPoints.length - 1);
  const targetIndex = Math.min(
    Math.max(snapIndex ?? (expanded ? maxIndex : 0), 0),
    maxIndex,
  );
  const androidHeight = contentSized
    ? Math.round(windowHeight * androidHeightRatio)
    : undefined;
  const hostHeight = useMemo(
    () =>
      Math.max(
        androidHeight ?? 0,
        ...snapPoints.map(
          (snapPoint) => resolveSnapHeight(snapPoint, windowHeight) ?? 0,
        ),
      ) || windowHeight,
    [androidHeight, snapPoints, windowHeight],
  );
  const visibleHeight = androidHeight ?? hostHeight;
  const sheetContentWidth = Math.min(windowWidth, ANDROID_SHEET_MAX_WIDTH);
  const animatedHeight = useSharedValue(visibleHeight);
  const animatedSurfaceStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const finishDismiss = useCallback(() => {
    if (dismissReportedRef.current) {
      return;
    }
    dismissReportedRef.current = true;
    setMounted(false);
    onDismissRef.current();
  }, []);

  useEffect(() => {
    if (visible) {
      hideGenerationRef.current += 1;
      dismissReportedRef.current = false;
      if (!mounted) {
        setMounted(true);
      }
      return;
    }
    if (!mounted) {
      return;
    }
    const generation = hideGenerationRef.current + 1;
    hideGenerationRef.current = generation;
    void sheetRef.current?.hide().then(() => {
      if (hideGenerationRef.current !== generation) {
        return;
      }
      if (visibleRef.current) {
        setMounted(false);
        requestAnimationFrame(() => setMounted(true));
        return;
      }
      finishDismiss();
    });
  }, [finishDismiss, mounted, visible]);

  useEffect(() => {
    cancelAnimation(animatedHeight);
    if (!mounted) {
      animatedHeight.value = visibleHeight;
      return;
    }
    animatedHeight.value = withTiming(visibleHeight, {
      duration: SHEET_RESIZE_DURATION_MS,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
    return () => cancelAnimation(animatedHeight);
  }, [animatedHeight, mounted, visibleHeight]);

  useEffect(() => {
    if (!mounted || contentSized || !hasMultipleSnapPoints) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (targetIndex === maxIndex) {
        void sheetRef.current?.expand();
      } else {
        void sheetRef.current?.partialExpand();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [contentSized, hasMultipleSnapPoints, maxIndex, mounted, targetIndex]);

  if (!mounted) {
    return null;
  }

  return (
    <Host
      colorScheme={theme.colorScheme}
      pointerEvents="none"
      seedColor={theme.accent}
      style={[styles.host, { width: windowWidth }]}
    >
      <ModalBottomSheet
        ref={sheetRef}
        containerColor="transparent"
        contentColor={theme.controlText}
        initialFullyExpanded={hasMultipleSnapPoints && targetIndex === maxIndex}
        properties={{
          shouldDismissOnBackPress: dismissible,
          shouldDismissOnClickOutside: dismissible,
        }}
        sheetGesturesEnabled={dismissible && allowsUserResizing}
        showDragHandle={false}
        skipPartiallyExpanded={contentSized || !hasMultipleSnapPoints}
        onBackRequest={onBackPress}
        onDismissRequest={finishDismiss}
      >
        {/* RNHostView's fill-parent mode consumes the dialog's full height
            before explicit modifiers are applied, which top-aligns the RN
            content and leaves a gap below it. Match the content instead so
            Material owns the bottom anchor, while mirroring its native 640dp
            width cap to avoid tablet-side clipping. */}
        <RNHostView matchContents>
          <View
            style={[
              styles.hostFrame,
              { height: hostHeight, width: sheetContentWidth },
            ]}
          >
            {dismissible && contentSized ? (
              <Pressable
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  void sheetRef.current?.hide().then(finishDismiss);
                }}
              />
            ) : null}
            <Animated.View
              style={[
                styles.sizedContent,
                {
                  backgroundColor: theme.panel,
                  shadowColor: theme.controlText,
                },
                animatedSurfaceStyle,
              ]}
              testID={testID}
            >
              <View
                style={[styles.safeContent, { paddingBottom: bottomInset }]}
              >
                {children}
              </View>
            </Animated.View>
          </View>
        </RNHostView>
      </ModalBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
  },
  hostFrame: {
    overflow: "visible",
    position: "relative",
    width: "100%",
  },
  safeContent: {
    flex: 1,
  },
  sizedContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    bottom: 0,
    elevation: 16,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
});
