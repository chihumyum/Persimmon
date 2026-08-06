import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { ReaderAppearanceSettings } from "../library/types";
import {
  READER_TYPOGRAPHY_CONTROLS,
  readerTypographyValues,
  type ReaderTypographyKey,
} from "../reader/reader-typography-preview";
import { ReaderNativeTypographyPicker } from "./reader-native-typography-picker";
import { ReaderResetTextButton } from "./reader-reset-text-button";
import { uiSize } from "./ui-tokens";

function formatTypographyValue(
  key: ReaderTypographyKey,
  value: number,
): string {
  switch (key) {
    case "fontSize":
    case "horizontalMargin":
      return `${value}`;
    case "lineHeight":
      return value.toFixed(2).replace(/0$/, "");
    case "paragraphSpacing":
      return value.toFixed(1);
  }
}

export interface ReaderTypographyPreviewProps {
  readonly appearance: ReaderAppearanceSettings;
  readonly theme: ReaderTheme;
  readonly onChange: (key: ReaderTypographyKey, value: number) => void;
  readonly onReset: () => void;
}

export function ReaderTypographyPreview({
  appearance,
  theme,
  onChange,
  onReset,
}: ReaderTypographyPreviewProps) {
  const { t } = useTranslation();
  const labels: Record<ReaderTypographyKey, string> = {
    fontSize: t("reader.fonts.fontSize"),
    horizontalMargin: t("reader.fonts.horizontalMargin"),
    lineHeight: t("reader.fonts.lineHeight"),
    paragraphSpacing: t("reader.fonts.paragraphSpacing"),
  };
  const columns = READER_TYPOGRAPHY_CONTROLS.map((control) =>
    readerTypographyValues(control),
  );
  const selectedIndices = READER_TYPOGRAPHY_CONTROLS.map((control, component) =>
    columns[component]!.reduce(
      (closest, candidate, index) =>
        Math.abs(candidate - appearance[control.key]) <
        Math.abs(columns[component]![closest]! - appearance[control.key])
          ? index
          : closest,
      0,
    ),
  );
  const formattedColumns = READER_TYPOGRAPHY_CONTROLS.map(
    (control, component) =>
      columns[component]!.map((value) =>
        formatTypographyValue(control.key, value),
      ),
  );
  const accessibilityLabels = READER_TYPOGRAPHY_CONTROLS.map(
    (control) => labels[control.key],
  );

  return (
    <View
      accessibilityLabel={t("reader.settings.typographyPreviewTitle")}
      accessibilityViewIsModal
      style={styles.sheetPage}
      testID="reader-typography-sheet"
    >
      <View style={styles.pickerGroup}>
        <ReaderNativeTypographyPicker
          accessibilityLabels={accessibilityLabels}
          columns={formattedColumns}
          selectedIndices={selectedIndices}
          theme={theme}
          onChange={(component, index) => {
            const control = READER_TYPOGRAPHY_CONTROLS[component];
            const value = columns[component]?.[index];
            if (control && value !== undefined) {
              onChange(control.key, value);
            }
          }}
        />
      </View>
      <ReaderResetTextButton
        accessibilityLabel={t("reader.settings.resetTypography")}
        label={t("reader.settings.resetTypography")}
        onPress={onReset}
        style={styles.footer}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignSelf: "center",
    height: uiSize.control,
    marginBottom: uiSize.sheetHeaderInset,
  },
  pickerGroup: {
    flexShrink: 0,
    width: "100%",
  },
  sheetPage: {
    flex: 1,
  },
});
