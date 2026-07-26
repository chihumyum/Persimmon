import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const CAROUSEL_INTERVAL_MS = 2800;
const HORIZONTAL_PADDING = 24;

function estimatedTextWidth(label: string): number {
  return [...label].reduce((width, character) => {
    if (character.trim().length === 0) {
      return width + 4;
    }
    return width + (character.charCodeAt(0) <= 0x7f ? 7 : 12);
  }, 0);
}

export interface ToolbarBreadcrumbCarouselProps {
  readonly labels: readonly string[];
}

export function ToolbarBreadcrumbCarousel({
  labels,
}: ToolbarBreadcrumbCarouselProps) {
  const normalizedLabels = useMemo(
    () => labels.map((label) => label.trim()).filter(Boolean),
    [labels],
  );
  const fullLabel = normalizedLabels.join(" › ");
  const estimatedFullLabelWidth = useMemo(
    () => estimatedTextWidth(fullLabel),
    [fullLabel],
  );
  const [availableWidth, setAvailableWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const overflowing =
    availableWidth > 0 && estimatedFullLabelWidth > availableWidth;

  useEffect(() => {
    setActiveIndex(0);
  }, [fullLabel]);

  useEffect(() => {
    if (!overflowing || normalizedLabels.length < 2) {
      return;
    }
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % normalizedLabels.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [normalizedLabels.length, overflowing]);

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
      {overflowing && normalizedLabels.length > 1 ? (
        <View style={styles.slide}>
          <Text style={styles.counter}>
            {activeIndex + 1}/{normalizedLabels.length}
          </Text>
          <Text numberOfLines={1} style={styles.label}>
            {normalizedLabels[activeIndex]}
          </Text>
        </View>
      ) : (
        <Text numberOfLines={1} style={styles.label}>
          {fullLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  counter: {
    color: "#a09388",
    flexShrink: 0,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  label: {
    color: "#6e6259",
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
  },
  slide: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minWidth: 0,
  },
});
