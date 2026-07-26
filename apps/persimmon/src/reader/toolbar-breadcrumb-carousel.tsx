import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import {
  estimatedToolbarBreadcrumbWidth,
  toolbarBreadcrumbLabel,
} from "./toolbar-breadcrumb";

const HORIZONTAL_PADDING = 24;
const CAROUSEL_GAP = 36;
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
  const cycleDistance = estimatedFullLabelWidth + CAROUSEL_GAP;

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!overflowing || cycleDistance <= 0) {
      return;
    }
    const cycleDuration = (cycleDistance / CAROUSEL_PIXELS_PER_SECOND) * 1000;
    const carousel = Animated.loop(
      Animated.timing(translateX, {
        duration: cycleDuration,
        easing: Easing.linear,
        toValue: -cycleDistance,
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true },
    );
    carousel.start();
    return () => carousel.stop();
  }, [cycleDistance, overflowing, translateX]);

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
          <Animated.View
            style={[
              styles.carouselTrack,
              {
                transform: [{ translateX }],
                width: cycleDistance * 2,
              },
            ]}
          >
            {[0, 1].map((copy) => (
              <Text
                key={copy}
                accessible={false}
                numberOfLines={1}
                style={[
                  styles.carouselLabel,
                  {
                    color,
                    marginRight: CAROUSEL_GAP,
                    width: estimatedFullLabelWidth,
                  },
                ]}
              >
                {fullLabel}
              </Text>
            ))}
          </Animated.View>
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
  carouselTrack: {
    alignItems: "center",
    flexDirection: "row",
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
