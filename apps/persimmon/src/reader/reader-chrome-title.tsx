import { PAGE_DECORATION_LINE_HEIGHT } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import type { HorizontalInsets } from "./reader-chrome-layout";
import { ToolbarBreadcrumbCarousel } from "./toolbar-breadcrumb-carousel";

/** Strip above and below the title line that also covers glyph edges. */
const STRIP_BLEED = 3;
/** How much smaller the toolbar title is when it starts to morph in. */
const MORPH_SCALE = 0.04;

export interface ReaderChromeTitleProps {
  /** 0 while reading, 1 while the toolbar shows. */
  readonly progress: SharedValue<number>;
  readonly windowWidth: number;
  readonly top: number;
  /** Where the page draws its own header (the book title). */
  readonly readingFrame: HorizontalInsets;
  /** The toolbar's header: where the reader is in the book. */
  readonly toolbarLabels: readonly string[];
  readonly toolbarFrame: HorizontalInsets;
  readonly color: string;
  readonly paperColor: string;
}

/**
 * Morphs the reader header from the page's book title into the toolbar's
 * chapter path. The page always draws its own header; this title sits on a
 * paper-colored strip that covers it. As the toolbar appears the strip fades
 * in over the book title while the chapter path slides in from the book
 * title's center, and the reverse as it hides. Nothing ever has to hand the
 * title from one renderer to the other, so it cannot blink or double up.
 */
export function ReaderChromeTitle({
  progress,
  windowWidth,
  top,
  readingFrame,
  toolbarLabels,
  toolbarFrame,
  color,
  paperColor,
}: ReaderChromeTitleProps) {
  const readingWidth = Math.max(
    0,
    windowWidth - readingFrame.left - readingFrame.right,
  );
  const toolbarWidth = Math.max(
    0,
    windowWidth - toolbarFrame.left - toolbarFrame.right,
  );
  const centerShift =
    readingFrame.left +
    readingWidth / 2 -
    (toolbarFrame.left + toolbarWidth / 2);
  const stripLeft = Math.min(readingFrame.left, toolbarFrame.left);
  const stripRight = Math.min(readingFrame.right, toolbarFrame.right);

  // The strip covers most of the book title before the chapter path comes
  // in. The short overlap keeps the two from reading as stacked lines, while
  // still leaving enough of a title on screen that the change never blinks.
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55], [0, 1], "clamp"),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 1], [0, 1], "clamp"),
    transform: [
      { translateX: centerShift * (1 - progress.value) },
      { scale: 1 - MORPH_SCALE * (1 - progress.value) },
    ],
  }));

  return (
    <View pointerEvents="none" style={[styles.row, { top }]}>
      <Animated.View
        style={[
          styles.strip,
          {
            backgroundColor: paperColor,
            left: stripLeft,
            right: stripRight,
          },
          stripStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.title,
          { left: toolbarFrame.left, width: toolbarWidth },
          titleStyle,
        ]}
      >
        <ToolbarBreadcrumbCarousel color={color} labels={toolbarLabels} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: PAGE_DECORATION_LINE_HEIGHT,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  strip: {
    bottom: -STRIP_BLEED,
    position: "absolute",
    top: -STRIP_BLEED,
  },
  title: {
    flexDirection: "row",
    height: PAGE_DECORATION_LINE_HEIGHT,
    position: "absolute",
    top: 0,
  },
});
