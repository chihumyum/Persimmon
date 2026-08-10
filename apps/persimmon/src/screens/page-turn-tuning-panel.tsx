import { useCallback, useMemo, useRef, useState } from "react";
import type { ReaderTheme } from "@persimmon/reader-skia/theme";
import {
  FORWARD_CLICK_PAGE_TURN_TUNING_RANGES,
  FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES,
} from "@persimmon/reader-skia/page-turn-tuning-ranges";
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  ReaderFloatingPanel,
  ReaderPanelHeader,
} from "../components/reader-floating-panel";
import { UiText as Text } from "../components/ui-text";
import { uiSpace } from "../components/ui-tokens";
import {
  DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING,
  DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING,
  type ReaderClickPageTurnTuning,
  type ReaderGesturePageTurnTuning,
  type ReaderPageTurnTuning,
  type ReaderReverseClickPageTurnTuning,
  type ReaderReverseGesturePageTurnTuning,
} from "../library/types";

interface PageTurnTuningPanelProps {
  readonly theme: ReaderTheme;
  readonly bottom: number;
  readonly tuning: ReaderPageTurnTuning;
  readonly onChange: (tuning: ReaderPageTurnTuning) => void;
  readonly onClose: () => void;
}

interface TuningSliderProps {
  readonly label: string;
  readonly maximum: number;
  readonly minimum: number;
  readonly step: number;
  readonly theme: ReaderTheme;
  readonly value: number;
  readonly valueLabel: string;
  readonly onChange: (value: number) => void;
}

function slider(
  label: string,
  value: number,
  minimum: number,
  maximum: number,
  step: number,
  fractionDigits: number,
  onChange: (value: number) => void,
): Omit<TuningSliderProps, "theme"> {
  return {
    label,
    maximum,
    minimum,
    step,
    value,
    valueLabel: value.toFixed(fractionDigits),
    onChange,
  };
}

function TuningSlider({
  label,
  maximum,
  minimum,
  step,
  theme,
  value,
  valueLabel,
  onChange,
}: TuningSliderProps) {
  const { t } = useTranslation();
  const trackWidth = useRef(1);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const updateFromEvent = useCallback(
    (event: GestureResponderEvent) => {
      const ratio = Math.min(
        1,
        Math.max(0, event.nativeEvent.locationX / trackWidth.current),
      );
      const stepCount = Math.round(
        (minimum + ratio * (maximum - minimum) - minimum) / step,
      );
      onChangeRef.current(
        Number(
          Math.min(
            maximum,
            Math.max(minimum, minimum + stepCount * step),
          ).toFixed(3),
        ),
      );
    },
    [maximum, minimum, step],
  );
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: updateFromEvent,
        onPanResponderMove: updateFromEvent,
        onPanResponderTerminationRequest: () => false,
      }),
    [updateFromEvent],
  );
  const ratio = (value - minimum) / (maximum - minimum);
  const percentage = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  const adjust = useCallback(
    (direction: 1 | -1) => {
      onChangeRef.current(
        Number(
          Math.min(
            maximum,
            Math.max(minimum, value + direction * step),
          ).toFixed(3),
        ),
      );
    },
    [maximum, minimum, step, value],
  );

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderLabelRow}>
        <Text style={[styles.sliderLabel, { color: theme.controlText }]}>
          {label}
        </Text>
        <Text style={[styles.sliderValue, { color: theme.secondaryText }]}>
          {valueLabel}
        </Text>
      </View>
      <View
        {...responder.panHandlers}
        accessibilityActions={[
          {
            name: "decrement",
            label: t("accessibility.decrease", { label }),
          },
          {
            name: "increment",
            label: t("accessibility.increase", { label }),
          },
        ]}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: minimum,
          max: maximum,
          now: value,
          text: valueLabel,
        }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") {
            adjust(1);
          } else if (event.nativeEvent.actionName === "decrement") {
            adjust(-1);
          }
        }}
        onLayout={(event: LayoutChangeEvent) => {
          trackWidth.current = Math.max(1, event.nativeEvent.layout.width);
        }}
        style={styles.sliderTouchTarget}
      >
        <View
          pointerEvents="none"
          style={[styles.sliderRail, { backgroundColor: theme.panelMuted }]}
        >
          <View
            style={[
              styles.sliderFill,
              { backgroundColor: theme.accent, width: percentage },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.sliderThumb,
            {
              backgroundColor: theme.paper,
              borderColor: theme.accent,
              left: percentage,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function PageTurnTuningPanel({
  theme,
  bottom,
  tuning,
  onChange,
  onClose,
}: PageTurnTuningPanelProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"click" | "gesture">("click");
  const [direction, setDirection] = useState<"forward" | "backward">(
    "backward",
  );
  const updateForwardClick = useCallback(
    (key: keyof ReaderClickPageTurnTuning, value: number) => {
      onChange({
        ...tuning,
        click: {
          ...tuning.click,
          forward: { ...tuning.click.forward, [key]: value },
        },
      });
    },
    [onChange, tuning],
  );
  const updateReverseClick = useCallback(
    (key: keyof ReaderReverseClickPageTurnTuning, value: number) => {
      const backward = { ...tuning.click.backward, [key]: value };
      if (
        key === "incomingRevealStartProgress" &&
        value + 0.02 > backward.incomingRevealEndProgress
      ) {
        backward.incomingRevealEndProgress = Math.min(0.95, value + 0.02);
      }
      onChange({
        ...tuning,
        click: { ...tuning.click, backward },
      });
    },
    [onChange, tuning],
  );
  const updateForwardGesture = useCallback(
    (key: keyof ReaderGesturePageTurnTuning, value: number) => {
      const gesture = { ...tuning.gesture.forward, [key]: value };
      if (key === "minimumSpeedScale" && value > gesture.maximumSpeedScale) {
        gesture.maximumSpeedScale = value;
      } else if (
        key === "maximumSpeedScale" &&
        value < gesture.minimumSpeedScale
      ) {
        gesture.minimumSpeedScale = value;
      }
      onChange({
        ...tuning,
        gesture: { ...tuning.gesture, forward: gesture },
      });
    },
    [onChange, tuning],
  );
  const updateReverseGesture = useCallback(
    (key: keyof ReaderReverseGesturePageTurnTuning, value: number) => {
      const backward = { ...tuning.gesture.backward, [key]: value };
      if (
        key === "incomingRevealStartProgress" &&
        value + 0.02 > backward.incomingRevealEndProgress
      ) {
        backward.incomingRevealEndProgress = Math.min(0.95, value + 0.02);
      } else if (
        key === "minimumSpeedScale" &&
        value > backward.maximumSpeedScale
      ) {
        backward.maximumSpeedScale = value;
      } else if (
        key === "maximumSpeedScale" &&
        value < backward.minimumSpeedScale
      ) {
        backward.minimumSpeedScale = value;
      }
      onChange({
        ...tuning,
        gesture: { ...tuning.gesture, backward },
      });
    },
    [onChange, tuning],
  );
  const forwardClick = tuning.click.forward;
  const reverseClick = tuning.click.backward;
  const forwardGesture = tuning.gesture.forward;
  const reverseGesture = tuning.gesture.backward;
  const sliders: readonly Omit<TuningSliderProps, "theme">[] =
    mode === "click" && direction === "forward"
      ? [
          slider(
            t("reader.tuning.clickReleaseX"),
            forwardClick.releaseX,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.releaseX.minimum,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.releaseX.maximum,
            0.01,
            2,
            (value) => updateForwardClick("releaseX", value),
          ),
          slider(
            t("reader.tuning.clickLiftVelocity"),
            forwardClick.liftVelocity,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftVelocity.minimum,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftVelocity.maximum,
            0.05,
            2,
            (value) => updateForwardClick("liftVelocity", value),
          ),
          slider(
            t("reader.tuning.clickLiftToLeft"),
            forwardClick.liftToLeft,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftToLeft.minimum,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.liftToLeft.maximum,
            0.05,
            2,
            (value) => updateForwardClick("liftToLeft", value),
          ),
          slider(
            t("reader.tuning.curvatureRelaxation"),
            forwardClick.curvatureRelaxation,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.curvatureRelaxation.minimum,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.curvatureRelaxation.maximum,
            0.25,
            2,
            (value) => updateForwardClick("curvatureRelaxation", value),
          ),
          slider(
            t("reader.tuning.playbackSpeed"),
            forwardClick.playbackSpeed,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.playbackSpeed.minimum,
            FORWARD_CLICK_PAGE_TURN_TUNING_RANGES.playbackSpeed.maximum,
            0.05,
            2,
            (value) => updateForwardClick("playbackSpeed", value),
          ),
        ]
      : mode === "gesture" && direction === "forward"
        ? [
            slider(
              t("reader.tuning.releaseX"),
              forwardGesture.releaseX,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.releaseX.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.releaseX.maximum,
              0.01,
              2,
              (value) => updateForwardGesture("releaseX", value),
            ),
            slider(
              t("reader.tuning.liftVelocity"),
              forwardGesture.liftVelocity,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftVelocity.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftVelocity.maximum,
              0.05,
              2,
              (value) => updateForwardGesture("liftVelocity", value),
            ),
            slider(
              t("reader.tuning.liftToLeft"),
              forwardGesture.liftToLeft,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftToLeft.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.liftToLeft.maximum,
              0.05,
              2,
              (value) => updateForwardGesture("liftToLeft", value),
            ),
            slider(
              t("reader.tuning.curvatureRelaxation"),
              forwardGesture.curvatureRelaxation,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.curvatureRelaxation
                .minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.curvatureRelaxation
                .maximum,
              0.25,
              2,
              (value) => updateForwardGesture("curvatureRelaxation", value),
            ),
            slider(
              t("reader.tuning.pageWeight"),
              forwardGesture.pageWeight,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.pageWeight.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.pageWeight.maximum,
              0.05,
              2,
              (value) => updateForwardGesture("pageWeight", value),
            ),
            slider(
              t("reader.tuning.commitThreshold"),
              forwardGesture.commitThreshold,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.commitThreshold.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.commitThreshold.maximum,
              0.01,
              2,
              (value) => updateForwardGesture("commitThreshold", value),
            ),
            slider(
              t("reader.tuning.minimumSpeedScale"),
              forwardGesture.minimumSpeedScale,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale.maximum,
              0.05,
              2,
              (value) => updateForwardGesture("minimumSpeedScale", value),
            ),
            slider(
              t("reader.tuning.maximumSpeedScale"),
              forwardGesture.maximumSpeedScale,
              forwardGesture.minimumSpeedScale,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.maximumSpeedScale.maximum,
              0.05,
              2,
              (value) => updateForwardGesture("maximumSpeedScale", value),
            ),
            slider(
              t("reader.tuning.velocityGain"),
              forwardGesture.velocityGain,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.maximum,
              0.05,
              2,
              (value) => updateForwardGesture("velocityGain", value),
            ),
            slider(
              t("reader.tuning.idleDecaySeconds"),
              forwardGesture.idleDecaySeconds,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds.minimum,
              FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds.maximum,
              0.005,
              3,
              (value) => updateForwardGesture("idleDecaySeconds", value),
            ),
          ]
        : mode === "click"
          ? [
              slider(
                t("reader.tuning.reverseReleaseX"),
                reverseClick.releaseX,
                0.25,
                0.95,
                0.01,
                2,
                (value) => updateReverseClick("releaseX", value),
              ),
              slider(
                t("reader.tuning.reverseCurvatureRelaxation"),
                reverseClick.curvatureRelaxation,
                2,
                20,
                0.25,
                2,
                (value) => updateReverseClick("curvatureRelaxation", value),
              ),
              slider(
                t("reader.tuning.incomingLandingStartProgress"),
                reverseClick.incomingLandingStartProgress,
                0.05,
                0.85,
                0.01,
                2,
                (value) =>
                  updateReverseClick("incomingLandingStartProgress", value),
              ),
              slider(
                t("reader.tuning.incomingRevealStartProgress"),
                reverseClick.incomingRevealStartProgress,
                0,
                0.85,
                0.01,
                2,
                (value) =>
                  updateReverseClick("incomingRevealStartProgress", value),
              ),
              slider(
                t("reader.tuning.incomingRevealEndProgress"),
                reverseClick.incomingRevealEndProgress,
                reverseClick.incomingRevealStartProgress + 0.02,
                0.95,
                0.01,
                2,
                (value) =>
                  updateReverseClick("incomingRevealEndProgress", value),
              ),
              slider(
                t("reader.tuning.incomingSettleDurationSeconds"),
                reverseClick.incomingSettleDurationSeconds,
                0.15,
                1.5,
                0.01,
                2,
                (value) =>
                  updateReverseClick("incomingSettleDurationSeconds", value),
              ),
              slider(
                t("reader.tuning.incomingSettleEasingPower"),
                reverseClick.incomingSettleEasingPower,
                0.75,
                6,
                0.05,
                2,
                (value) =>
                  updateReverseClick("incomingSettleEasingPower", value),
              ),
              slider(
                t("reader.tuning.playbackSpeed"),
                reverseClick.playbackSpeed,
                0.25,
                3,
                0.05,
                2,
                (value) => updateReverseClick("playbackSpeed", value),
              ),
            ]
          : [
              slider(
                t("reader.tuning.reverseReleaseX"),
                reverseGesture.releaseX,
                0.25,
                0.95,
                0.01,
                2,
                (value) => updateReverseGesture("releaseX", value),
              ),
              slider(
                t("reader.tuning.reverseCurvatureRelaxation"),
                reverseGesture.curvatureRelaxation,
                2,
                20,
                0.25,
                2,
                (value) => updateReverseGesture("curvatureRelaxation", value),
              ),
              slider(
                t("reader.tuning.incomingLandingStartProgress"),
                reverseGesture.incomingLandingStartProgress,
                0.05,
                0.85,
                0.01,
                2,
                (value) =>
                  updateReverseGesture("incomingLandingStartProgress", value),
              ),
              slider(
                t("reader.tuning.incomingRevealStartProgress"),
                reverseGesture.incomingRevealStartProgress,
                0,
                0.85,
                0.01,
                2,
                (value) =>
                  updateReverseGesture("incomingRevealStartProgress", value),
              ),
              slider(
                t("reader.tuning.incomingRevealEndProgress"),
                reverseGesture.incomingRevealEndProgress,
                reverseGesture.incomingRevealStartProgress + 0.02,
                0.95,
                0.01,
                2,
                (value) =>
                  updateReverseGesture("incomingRevealEndProgress", value),
              ),
              slider(
                t("reader.tuning.incomingDragProgressScale"),
                reverseGesture.incomingDragProgressScale,
                0.25,
                3,
                0.05,
                2,
                (value) =>
                  updateReverseGesture("incomingDragProgressScale", value),
              ),
              slider(
                t("reader.tuning.incomingDragProgressExponent"),
                reverseGesture.incomingDragProgressExponent,
                0.35,
                3,
                0.05,
                2,
                (value) =>
                  updateReverseGesture("incomingDragProgressExponent", value),
              ),
              slider(
                t("reader.tuning.incomingSettleDurationSeconds"),
                reverseGesture.incomingSettleDurationSeconds,
                0.15,
                1.5,
                0.01,
                2,
                (value) =>
                  updateReverseGesture("incomingSettleDurationSeconds", value),
              ),
              slider(
                t("reader.tuning.incomingSettleEasingPower"),
                reverseGesture.incomingSettleEasingPower,
                0.75,
                6,
                0.05,
                2,
                (value) =>
                  updateReverseGesture("incomingSettleEasingPower", value),
              ),
              slider(
                t("reader.tuning.incomingRevertDurationSeconds"),
                reverseGesture.incomingRevertDurationSeconds,
                0.1,
                1.5,
                0.01,
                2,
                (value) =>
                  updateReverseGesture("incomingRevertDurationSeconds", value),
              ),
              slider(
                t("reader.tuning.pageWeight"),
                reverseGesture.pageWeight,
                0.25,
                3,
                0.05,
                2,
                (value) => updateReverseGesture("pageWeight", value),
              ),
              slider(
                t("reader.tuning.commitThreshold"),
                reverseGesture.commitThreshold,
                0.15,
                1.5,
                0.01,
                2,
                (value) => updateReverseGesture("commitThreshold", value),
              ),
              slider(
                t("reader.tuning.minimumSpeedScale"),
                reverseGesture.minimumSpeedScale,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale
                  .minimum,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.minimumSpeedScale
                  .maximum,
                0.05,
                2,
                (value) => updateReverseGesture("minimumSpeedScale", value),
              ),
              slider(
                t("reader.tuning.maximumSpeedScale"),
                reverseGesture.maximumSpeedScale,
                reverseGesture.minimumSpeedScale,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.maximumSpeedScale
                  .maximum,
                0.05,
                2,
                (value) => updateReverseGesture("maximumSpeedScale", value),
              ),
              slider(
                t("reader.tuning.velocityGain"),
                reverseGesture.velocityGain,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.minimum,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.velocityGain.maximum,
                0.05,
                2,
                (value) => updateReverseGesture("velocityGain", value),
              ),
              slider(
                t("reader.tuning.idleDecaySeconds"),
                reverseGesture.idleDecaySeconds,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds
                  .minimum,
                FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES.idleDecaySeconds
                  .maximum,
                0.005,
                3,
                (value) => updateReverseGesture("idleDecaySeconds", value),
              ),
            ];

  return (
    <ReaderFloatingPanel
      bottom={bottom}
      maxHeight="82%"
      maxWidth={330}
      padding={14}
      theme={theme}
      width="84%"
      style={styles.panel}
    >
      <ReaderPanelHeader
        closeAccessibilityLabel={t("reader.tuning.closeAccessibility")}
        theme={theme}
        title={t("reader.tuning.title")}
        style={styles.header}
        onClose={onClose}
      />

      <View style={[styles.modeTabs, { backgroundColor: theme.panelMuted }]}>
        {(["click", "gesture"] as const).map((candidate) => {
          const selected = mode === candidate;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={candidate}
              onPress={() => setMode(candidate)}
              style={[
                styles.modeTab,
                selected && { backgroundColor: theme.panelRaised },
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color: selected ? theme.accentStrong : theme.secondaryText,
                  },
                ]}
              >
                {candidate === "click"
                  ? t("reader.tuning.clickMode")
                  : t("reader.tuning.gestureMode")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.modeTabs, { backgroundColor: theme.panelMuted }]}>
        {(["forward", "backward"] as const).map((candidate) => {
          const selected = direction === candidate;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={candidate}
              onPress={() => setDirection(candidate)}
              style={[
                styles.modeTab,
                selected && { backgroundColor: theme.panelRaised },
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color: selected ? theme.accentStrong : theme.secondaryText,
                  },
                ]}
              >
                {candidate === "forward"
                  ? t("reader.tuning.forwardMode")
                  : t("reader.tuning.backwardMode")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.sliderList}
        showsVerticalScrollIndicator
        style={styles.sliderScroller}
      >
        {sliders.map((properties) => (
          <TuningSlider key={properties.label} {...properties} theme={theme} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={[styles.equation, { color: theme.secondaryText }]}>
          {direction === "forward"
            ? t("reader.tuning.propagationSpeed", {
                value: (mode === "click"
                  ? forwardClick.liftVelocity * forwardClick.liftToLeft
                  : forwardGesture.liftVelocity * forwardGesture.liftToLeft
                ).toFixed(2),
              })
            : t("reader.tuning.reverseHint")}
        </Text>
        <Pressable
          accessibilityLabel={t("reader.tuning.resetAccessibility")}
          accessibilityRole="button"
          onPress={() =>
            onChange(
              mode === "click" && direction === "forward"
                ? {
                    ...tuning,
                    click: {
                      ...tuning.click,
                      forward: DEFAULT_READER_CLICK_PAGE_TURN_TUNING,
                    },
                  }
                : mode === "click"
                  ? {
                      ...tuning,
                      click: {
                        ...tuning.click,
                        backward: DEFAULT_READER_REVERSE_CLICK_PAGE_TURN_TUNING,
                      },
                    }
                  : direction === "forward"
                    ? {
                        ...tuning,
                        gesture: {
                          ...tuning.gesture,
                          forward: DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
                        },
                      }
                    : {
                        ...tuning,
                        gesture: {
                          ...tuning.gesture,
                          backward:
                            DEFAULT_READER_REVERSE_GESTURE_PAGE_TURN_TUNING,
                        },
                      },
            )
          }
        >
          <Text style={[styles.resetText, { color: theme.accentStrong }]}>
            {t("reader.tuning.reset")}
          </Text>
        </Pressable>
      </View>
    </ReaderFloatingPanel>
  );
}

const styles = StyleSheet.create({
  equation: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  header: {
    marginBottom: uiSpace.xxs + uiSpace.hairline,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 9,
    flex: 1,
    paddingVertical: 7,
  },
  modeTabs: {
    borderRadius: 11,
    flexDirection: "row",
    marginBottom: 5,
    padding: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  panel: {
    zIndex: 25,
  },
  resetText: {
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 5,
  },
  sliderFill: {
    borderRadius: 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  sliderLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderList: {
    paddingRight: 4,
  },
  sliderRail: {
    borderRadius: 2,
    height: 4,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 12,
  },
  sliderRow: {
    gap: 1,
  },
  sliderScroller: {
    flexShrink: 1,
  },
  sliderThumb: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    marginLeft: -7,
    position: "absolute",
    top: 7,
    width: 14,
  },
  sliderTouchTarget: {
    height: 28,
    justifyContent: "center",
  },
  sliderValue: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});
