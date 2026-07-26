import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import {
  estimatedToolbarBreadcrumbWidth,
  toolbarBreadcrumbLabel,
} from "./toolbar-breadcrumb";

const HORIZONTAL_PADDING = 24;
const CAROUSEL_EDGE_PAUSE_MS = 1200;
const CAROUSEL_PIXELS_PER_SECOND = 28;

export interface ToolbarBreadcrumbCarouselProps {
  readonly color?: string;
  readonly labels: readonly string[];
}

export function ToolbarBreadcrumbCarousel({
  color = "#6e6259",
  labels,
}: ToolbarBreadcrumbCarouselProps) {
  const fullLabel = useMemo(() => toolbarBreadcrumbLabel(labels), [labels]);
  const estimatedFullLabelWidth = useMemo(
    () => estimatedToolbarBreadcrumbWidth(fullLabel),
    [fullLabel],
  );
  const [availableWidth, setAvailableWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const overflowing =
    availableWidth > 0 && estimatedFullLabelWidth > availableWidth;
  const travel = Math.max(0, estimatedFullLabelWidth - availableWidth);

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!overflowing || travel <= 0) {
      return;
    }
    const travelDuration = Math.max(
      1600,
      (travel / CAROUSEL_PIXELS_PER_SECOND) * 1000,
    );
    const carousel = Animated.loop(
      Animated.sequence([
        Animated.delay(CAROUSEL_EDGE_PAUSE_MS),
        Animated.timing(translateX, {
          duration: travelDuration,
          easing: Easing.inOut(Easing.cubic),
          toValue: -travel,
          useNativeDriver: true,
        }),
        Animated.delay(CAROUSEL_EDGE_PAUSE_MS),
        Animated.timing(translateX, {
          duration: travelDuration,
          easing: Easing.inOut(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    carousel.start();
    return () => carousel.stop();
  }, [overflowing, translateX, travel]);

  if (!fullLabel) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel={`目录层级：${fullLabel}`}
      accessibilityRole="header"
      onLayout={(event) =>
        setAvailableWidth(
          Math.max(0, event.nativeEvent.layout.width - HORIZONTAL_PADDING),
        )
      }
      pointerEvents="none"
      style={styles.container}
    >
      {overflowing ? (
        <View style={styles.carouselViewport}>
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.carouselLabel,
              {
                color,
                transform: [{ translateX }],
                width: estimatedFullLabelWidth,
              },
            ]}
          >
            {fullLabel}
          </Animated.Text>
        </View>
      ) : (
        <Text numberOfLines={1} style={[styles.label, { color }]}>
          {fullLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselLabel: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "left",
  },
  carouselViewport: {
    alignSelf: "stretch",
    justifyContent: "center",
    overflow: "hidden",
  },
  container: {
    alignItems: "center",
    flex: 1,
    height: 36,
    justifyContent: "center",
    marginHorizontal: 12,
    minWidth: 0,
    overflow: "hidden",
    paddingHorizontal: 12,
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
  },
});
