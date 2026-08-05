import {
  PAGE_DECORATION_FONT_SIZE,
  PAGE_DECORATION_LETTER_SPACING,
  PAGE_DECORATION_LINE_HEIGHT,
} from "@persimmon/reader-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { UiText as Text } from "../components/ui-text";
import { READER_UI_FONT_FAMILY } from "./reader-ui-typography";
import {
  estimatedToolbarBreadcrumbWidth,
  toolbarBreadcrumbLabel,
} from "./toolbar-breadcrumb";

const CAROUSEL_GAP = 36;
const CAROUSEL_PIXELS_PER_SECOND = 28;

export interface ToolbarBreadcrumbCarouselProps {
  readonly color: string;
  readonly labels: readonly string[];
}

export function ToolbarBreadcrumbCarousel({
  color,
  labels,
}: ToolbarBreadcrumbCarouselProps) {
  const { t } = useTranslation();
  const fullLabel = useMemo(() => toolbarBreadcrumbLabel(labels), [labels]);
  const estimatedFullLabelWidth = useMemo(
    () => estimatedToolbarBreadcrumbWidth(fullLabel),
    [fullLabel],
  );
  const [availableWidth, setAvailableWidth] = useState(0);
  const pixelRatio = useRef(Math.max(1, PixelRatio.get())).current;
  const translateX = useSharedValue(0);
  const overflowing =
    availableWidth > 0 && estimatedFullLabelWidth > availableWidth;
  const cycleDistance = estimatedFullLabelWidth + CAROUSEL_GAP;
  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: Math.round(translateX.value * pixelRatio) / pixelRatio,
      },
    ],
  }));

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;
    if (!overflowing || cycleDistance <= 0) {
      return;
    }
    const cycleDuration = (cycleDistance / CAROUSEL_PIXELS_PER_SECOND) * 1000;
    translateX.value = withRepeat(
      withTiming(-cycleDistance, {
        duration: cycleDuration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(translateX);
  }, [cycleDistance, overflowing, translateX]);

  if (!fullLabel) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLabel={t("reader.toolbar.breadcrumbAccessibility", {
        label: fullLabel,
      })}
      accessibilityRole="header"
      onLayout={(event) =>
        setAvailableWidth(Math.max(0, event.nativeEvent.layout.width))
      }
      pointerEvents="none"
      style={styles.container}
    >
      {overflowing ? (
        <View style={styles.carouselViewport}>
          <Animated.View
            style={[
              styles.carouselTrack,
              trackStyle,
              {
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
                  styles.decorationText,
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
        <Text
          numberOfLines={1}
          style={[styles.decorationText, styles.label, { color }]}
        >
          {fullLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselLabel: {
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
    height: PAGE_DECORATION_LINE_HEIGHT,
    justifyContent: "center",
    minWidth: 0,
    overflow: "hidden",
  },
  decorationText: {
    fontFamily: READER_UI_FONT_FAMILY,
    fontSize: PAGE_DECORATION_FONT_SIZE,
    includeFontPadding: false,
    letterSpacing: PAGE_DECORATION_LETTER_SPACING,
    lineHeight: PAGE_DECORATION_LINE_HEIGHT,
  },
  label: {
    flexShrink: 1,
    textAlign: "center",
  },
});
