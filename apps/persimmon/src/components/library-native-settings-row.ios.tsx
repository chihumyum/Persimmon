import {
  Button,
  HStack,
  Image,
  Menu,
  ProgressView,
  Spacer,
  Text,
  Toggle,
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
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import type {
  LibraryNativeActionRowProps,
  LibraryNativeMenuRowProps,
  LibraryNativeSwitchRowProps,
} from "./library-native-settings-row.types";
import { uiSize, uiTypography } from "./ui-tokens";

function RowCopy({
  description,
  theme,
  title,
  titleColor = theme.controlText,
}: {
  readonly description?: string;
  readonly theme: LibraryNativeActionRowProps["theme"];
  readonly title: string;
  readonly titleColor?: string;
}) {
  return (
    <VStack alignment="leading" spacing={2}>
      <Text
        modifiers={[
          font({
            size: uiTypography.optionLabel.fontSize,
            weight: "medium",
          }),
          foregroundStyle(titleColor),
          lineLimit(2),
        ]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          modifiers={[
            font({ size: uiTypography.optionDescription.fontSize }),
            foregroundStyle(theme.secondaryText),
            lineLimit(3),
          ]}
        >
          {description}
        </Text>
      ) : null}
    </VStack>
  );
}

export function LibraryNativeMenuRow<Value extends string>({
  accessibilityLabel: rowAccessibilityLabel,
  description,
  options,
  theme,
  title,
  value,
  onChange,
}: LibraryNativeMenuRowProps<Value>) {
  const selected = options.find((option) => option.value === value);
  return (
    <HStack
      alignment="center"
      modifiers={[
        frame({
          maxWidth: 10_000,
          minHeight: description
            ? uiSize.nativeGroupedRowWithDescriptionContent
            : uiSize.nativeGroupedRowContent,
        }),
      ]}
    >
      <RowCopy description={description} theme={theme} title={title} />
      <Spacer minLength={12} />
      <Menu
        label={
          <HStack alignment="center" spacing={5}>
            <Text
              modifiers={[
                font({ size: uiTypography.optionValue.fontSize }),
                foregroundStyle(theme.secondaryText),
                lineLimit(1),
              ]}
            >
              {selected?.label ?? value}
            </Text>
            <Image
              color={theme.secondaryText}
              size={11}
              systemName="chevron.down"
            />
          </HStack>
        }
        modifiers={[accessibilityLabel(rowAccessibilityLabel)]}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            systemImage={option.value === value ? "checkmark" : undefined}
            onPress={() => onChange(option.value)}
          />
        ))}
      </Menu>
    </HStack>
  );
}

export function LibraryNativeSwitchRow({
  description,
  disabled = false,
  theme,
  title,
  value,
  onChange,
}: LibraryNativeSwitchRowProps) {
  return (
    <Toggle
      isOn={value}
      modifiers={[
        frame({
          maxWidth: 10_000,
          minHeight: description
            ? uiSize.nativeGroupedRowWithDescriptionContent
            : uiSize.nativeGroupedRowContent,
        }),
        tint(theme.accent),
        disabledModifier(disabled),
      ]}
      onIsOnChange={onChange}
    >
      <RowCopy description={description} theme={theme} title={title} />
    </Toggle>
  );
}

function ActionContent({
  description,
  loading,
  showsChevron,
  theme,
  title,
  tone = "default",
  value,
}: Omit<
  LibraryNativeActionRowProps,
  "accessibilityLabel" | "disabled" | "onPress"
>) {
  const titleColor =
    tone === "danger"
      ? "#ff3b30"
      : tone === "accent"
        ? theme.accentStrong
        : theme.controlText;
  return (
    <HStack
      alignment="center"
      modifiers={[
        frame({
          maxWidth: 10_000,
          minHeight: description
            ? uiSize.nativeGroupedRowWithDescriptionContent
            : uiSize.nativeGroupedRowContent,
        }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <RowCopy
        description={description}
        theme={theme}
        title={title}
        titleColor={titleColor}
      />
      <Spacer minLength={12} />
      {value ? (
        <Text
          modifiers={[
            font({ size: uiTypography.optionValue.fontSize }),
            foregroundStyle(theme.secondaryText),
            lineLimit(1),
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

export function LibraryNativeActionRow({
  accessibilityLabel: rowAccessibilityLabel,
  disabled = false,
  onPress,
  ...contentProps
}: LibraryNativeActionRowProps) {
  const content = <ActionContent {...contentProps} />;
  if (!onPress) return content;
  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        disabledModifier(disabled),
        accessibilityLabel(rowAccessibilityLabel ?? contentProps.title),
      ]}
      onPress={onPress}
    >
      {content}
    </Button>
  );
}
