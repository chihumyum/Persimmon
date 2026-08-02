import { useCallback, useMemo, useRef } from "react";
import type { ReaderTheme } from "@persimmon/reader-skia/theme";
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
  DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
  type ReaderGesturePageTurnTuning,
  type ReaderPageTurnTuning,
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
  const updateFromEvent = useCallback(
    (event: GestureResponderEvent) => {
      const ratio = Math.min(
        1,
        Math.max(0, event.nativeEvent.locationX / trackWidth.current),
      );
      const stepCount = Math.round(
        (minimum + ratio * (maximum - minimum) - minimum) / step,
      );
      onChange(
        Number(
          Math.min(
            maximum,
            Math.max(minimum, minimum + stepCount * step),
          ).toFixed(3),
        ),
      );
    },
    [maximum, minimum, onChange, step],
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
      onChange(
        Number(
          Math.min(
            maximum,
            Math.max(minimum, value + direction * step),
          ).toFixed(3),
        ),
      );
    },
    [maximum, minimum, onChange, step, value],
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
  const updateGesture = useCallback(
    (key: keyof ReaderGesturePageTurnTuning, value: number) => {
      const gesture = { ...tuning.gesture, [key]: value };
      if (key === "minimumSpeedScale" && value > gesture.maximumSpeedScale) {
        gesture.maximumSpeedScale = value;
      } else if (
        key === "maximumSpeedScale" &&
        value < gesture.minimumSpeedScale
      ) {
        gesture.minimumSpeedScale = value;
      }
      onChange({ ...tuning, gesture });
    },
    [onChange, tuning],
  );

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

      <ScrollView
        contentContainerStyle={styles.sliderList}
        showsVerticalScrollIndicator
        style={styles.sliderScroller}
      >
        <TuningSlider
          label={t("reader.tuning.releaseX")}
          maximum={0.8}
          minimum={0.58}
          step={0.01}
          theme={theme}
          value={tuning.gesture.releaseX}
          valueLabel={tuning.gesture.releaseX.toFixed(2)}
          onChange={(value) => updateGesture("releaseX", value)}
        />
        <TuningSlider
          label={t("reader.tuning.liftVelocity")}
          maximum={1.8}
          minimum={0.7}
          step={0.05}
          theme={theme}
          value={tuning.gesture.liftVelocity}
          valueLabel={tuning.gesture.liftVelocity.toFixed(2)}
          onChange={(value) => updateGesture("liftVelocity", value)}
        />
        <TuningSlider
          label={t("reader.tuning.liftToLeft")}
          maximum={2.6}
          minimum={1.4}
          step={0.05}
          theme={theme}
          value={tuning.gesture.liftToLeft}
          valueLabel={tuning.gesture.liftToLeft.toFixed(2)}
          onChange={(value) => updateGesture("liftToLeft", value)}
        />
        <TuningSlider
          label={t("reader.tuning.curvatureRelaxation")}
          maximum={14}
          minimum={3.5}
          step={0.25}
          theme={theme}
          value={tuning.gesture.curvatureRelaxation}
          valueLabel={tuning.gesture.curvatureRelaxation.toFixed(2)}
          onChange={(value) => updateGesture("curvatureRelaxation", value)}
        />
        <TuningSlider
          label={t("reader.tuning.pageWeight")}
          maximum={1.8}
          minimum={0.5}
          step={0.05}
          theme={theme}
          value={tuning.gesture.pageWeight}
          valueLabel={tuning.gesture.pageWeight.toFixed(2)}
          onChange={(value) => updateGesture("pageWeight", value)}
        />
        <TuningSlider
          label={t("reader.tuning.commitThreshold")}
          maximum={1.2}
          minimum={0.4}
          step={0.01}
          theme={theme}
          value={tuning.gesture.commitThreshold}
          valueLabel={tuning.gesture.commitThreshold.toFixed(2)}
          onChange={(value) => updateGesture("commitThreshold", value)}
        />
        <TuningSlider
          label={t("reader.tuning.minimumSpeedScale")}
          maximum={1.5}
          minimum={0.5}
          step={0.05}
          theme={theme}
          value={tuning.gesture.minimumSpeedScale}
          valueLabel={tuning.gesture.minimumSpeedScale.toFixed(2)}
          onChange={(value) => updateGesture("minimumSpeedScale", value)}
        />
        <TuningSlider
          label={t("reader.tuning.maximumSpeedScale")}
          maximum={3}
          minimum={tuning.gesture.minimumSpeedScale}
          step={0.05}
          theme={theme}
          value={tuning.gesture.maximumSpeedScale}
          valueLabel={tuning.gesture.maximumSpeedScale.toFixed(2)}
          onChange={(value) => updateGesture("maximumSpeedScale", value)}
        />
        <TuningSlider
          label={t("reader.tuning.velocityGain")}
          maximum={1.2}
          minimum={0.1}
          step={0.05}
          theme={theme}
          value={tuning.gesture.velocityGain}
          valueLabel={tuning.gesture.velocityGain.toFixed(2)}
          onChange={(value) => updateGesture("velocityGain", value)}
        />
        <TuningSlider
          label={t("reader.tuning.idleDecaySeconds")}
          maximum={0.2}
          minimum={0.03}
          step={0.005}
          theme={theme}
          value={tuning.gesture.idleDecaySeconds}
          valueLabel={tuning.gesture.idleDecaySeconds.toFixed(3)}
          onChange={(value) => updateGesture("idleDecaySeconds", value)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={[styles.equation, { color: theme.secondaryText }]}>
          {t("reader.tuning.propagationSpeed", {
            value: (
              tuning.gesture.liftVelocity * tuning.gesture.liftToLeft
            ).toFixed(2),
          })}
        </Text>
        <Pressable
          accessibilityLabel={t("reader.tuning.resetAccessibility")}
          accessibilityRole="button"
          onPress={() =>
            onChange({
              ...tuning,
              gesture: DEFAULT_READER_GESTURE_PAGE_TURN_TUNING,
            })
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
