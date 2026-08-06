import {
  Button,
  Host,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  multilineTextAlignment,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";

import type { ReaderSettingsActionRowProps } from "./reader-settings-action-row.types";
import { uiSize, uiSpace, uiTypography } from "./ui-tokens";

function ActionContent({
  description,
  disabled = false,
  loading = false,
  showsChevron = false,
  theme,
  title,
  tone = "default",
  value,
  wrapsValue = false,
}: Omit<ReaderSettingsActionRowProps, "accessibilityLabel" | "onPress">) {
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  const titleColor = disabled
    ? theme.secondaryText
    : tone === "danger"
      ? "#ff3b30"
      : tone === "accent"
        ? theme.accentStrong
        : theme.controlText;

  return (
    <HStack
      alignment="center"
      modifiers={[
        padding({ horizontal: uiSize.optionHorizontalInset }),
        frame({ maxWidth: 10_000, height: rowHeight, alignment: "leading" }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <VStack
        alignment="leading"
        modifiers={
          wrapsValue
            ? [
                frame({
                  width: uiSize.optionLabelColumn,
                  alignment: "leading",
                }),
              ]
            : undefined
        }
        spacing={2}
      >
        <Text
          modifiers={[
            font({
              size: uiTypography.optionLabel.fontSize,
              weight: "medium",
            }),
            foregroundStyle(titleColor),
            lineLimit(wrapsValue ? 1 : 2),
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            modifiers={[
              font({ size: uiTypography.optionDescription.fontSize }),
              foregroundStyle(theme.secondaryText),
              lineLimit(2),
            ]}
          >
            {description}
          </Text>
        ) : null}
      </VStack>
      <Spacer minLength={uiSpace.md} />
      {value ? (
        <Text
          modifiers={[
            font({ size: uiTypography.optionValue.fontSize }),
            foregroundStyle(theme.secondaryText),
            lineLimit(wrapsValue ? 2 : 1),
            ...(wrapsValue
              ? [
                  frame({ maxWidth: 10_000, alignment: "trailing" }),
                  multilineTextAlignment("trailing"),
                ]
              : []),
          ]}
        >
          {value}
        </Text>
      ) : null}
      {loading ? <ProgressView /> : null}
      {showsChevron ? (
        <Image
          color={theme.secondaryText}
          size={13}
          systemName="chevron.right"
        />
      ) : null}
    </HStack>
  );
}

export function ReaderSettingsActionRow({
  accessibilityLabel: rowAccessibilityLabel,
  description,
  disabled = false,
  loading = false,
  showsChevron = false,
  theme,
  title,
  tone = "default",
  value,
  wrapsValue = false,
  onPress,
}: ReaderSettingsActionRowProps) {
  const rowHeight = description
    ? uiSize.optionRowWithDescription
    : uiSize.optionRow;
  const content = (
    <ActionContent
      description={description}
      disabled={disabled}
      loading={loading}
      showsChevron={showsChevron}
      theme={theme}
      title={title}
      tone={tone}
      value={value}
      wrapsValue={wrapsValue}
    />
  );

  return (
    <Host
      colorScheme={theme.colorScheme}
      ignoreSafeArea="all"
      seedColor={theme.accent}
      style={[styles.host, { height: rowHeight }]}
    >
      {onPress ? (
        <Button
          modifiers={[
            buttonStyle("plain"),
            disabledModifier(disabled),
            accessibilityLabel(rowAccessibilityLabel ?? title),
          ]}
          onPress={onPress}
        >
          {content}
        </Button>
      ) : (
        content
      )}
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});

export type { ReaderSettingsActionRowProps } from "./reader-settings-action-row.types";
