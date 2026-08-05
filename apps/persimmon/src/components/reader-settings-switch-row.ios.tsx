import type { ReaderTheme } from "@persimmon/reader-skia";
import { requireNativeView } from "expo";
import type { ComponentType } from "react";
import {
  processColor,
  StyleSheet,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";
import { uiSize, uiTypography } from "./ui-tokens";

interface NativeReaderSettingsSwitchRowProps extends ViewProps {
  readonly accentColor: ReturnType<typeof processColor>;
  readonly descriptionFontSize: number;
  readonly descriptionText: string;
  readonly enabled: boolean;
  readonly horizontalInset: number;
  readonly label: string;
  readonly labelFontSize: number;
  readonly offTrackColor: ReturnType<typeof processColor>;
  readonly secondaryTextColor: ReturnType<typeof processColor>;
  readonly textColor: ReturnType<typeof processColor>;
  readonly thumbColor: ReturnType<typeof processColor>;
  readonly value: boolean;
  readonly onValueChange?: (
    event: NativeSyntheticEvent<{ readonly value: boolean }>,
  ) => void;
}

const NativeReaderSettingsSwitchRowView: ComponentType<NativeReaderSettingsSwitchRowProps> =
  requireNativeView<NativeReaderSettingsSwitchRowProps>(
    "PersimmonSelectionMenu",
    "PersimmonReaderSwitchRowView",
  );

interface ReaderSettingsSwitchRowProps {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly theme: ReaderTheme;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}

export function ReaderSettingsSwitchRow({
  description,
  disabled = false,
  label,
  theme,
  value,
  onChange,
}: ReaderSettingsSwitchRowProps) {
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  return (
    <NativeReaderSettingsSwitchRowView
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accentColor={processColor(theme.accent)}
      descriptionText={description ?? ""}
      descriptionFontSize={uiTypography.optionDescription.fontSize}
      enabled={!disabled}
      horizontalInset={uiSize.optionHorizontalInset}
      label={label}
      labelFontSize={uiTypography.optionLabel.fontSize}
      offTrackColor={processColor(theme.panel)}
      secondaryTextColor={processColor(theme.secondaryText)}
      style={[styles.row, { height: rowHeight }]}
      textColor={processColor(theme.controlText)}
      thumbColor={processColor("#ffffff")}
      value={value}
      onValueChange={({ nativeEvent }) => onChange(nativeEvent.value)}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
  },
});
