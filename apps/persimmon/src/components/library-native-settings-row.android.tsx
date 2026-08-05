import {
  CircularProgressIndicator,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Row,
  Switch,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  padding,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import checkIcon from "../assets/icons/check.xml";
import chevronDownIcon from "../assets/icons/chevron_down.xml";
import chevronRightIcon from "../assets/icons/chevron_right.xml";
import type {
  LibraryNativeActionRowProps,
  LibraryNativeMenuRowProps,
  LibraryNativeSwitchRowProps,
} from "./library-native-settings-row.types";
import { uiTypography } from "./ui-tokens";

function RowCopy({
  description,
  disabled = false,
  theme,
  title,
  titleColor = theme.controlText,
}: {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly theme: LibraryNativeActionRowProps["theme"];
  readonly title: string;
  readonly titleColor?: string;
}) {
  return (
    <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 2 }}>
      <Text
        color={disabled ? theme.secondaryText : titleColor}
        maxLines={2}
        style={uiTypography.optionLabel}
      >
        {title}
      </Text>
      {description ? (
        <Text
          color={theme.secondaryText}
          maxLines={3}
          style={uiTypography.optionDescription}
        >
          {description}
        </Text>
      ) : null}
    </Column>
  );
}

export function LibraryNativeMenuRow<Value extends string>({
  accessibilityLabel,
  description,
  options,
  theme,
  title,
  value,
  onChange,
}: LibraryNativeMenuRowProps<Value>) {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <RowCopy description={description} theme={theme} title={title} />
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
      >
        <DropdownMenu.Trigger>
          <Row
            horizontalArrangement={{ spacedBy: 4 }}
            verticalAlignment="center"
            modifiers={[
              padding(10, 10, 0, 10),
              clickable(() => setExpanded(true)),
            ]}
          >
            <Text
              color={theme.secondaryText}
              maxLines={1}
              style={uiTypography.optionValue}
            >
              {selected?.label ?? value}
            </Text>
            <Icon
              contentDescription={accessibilityLabel}
              size={18}
              source={chevronDownIcon}
              tint={theme.secondaryText}
            />
          </Row>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {options.map((option) => (
            <DropdownMenuItem
              elementColors={{
                textColor: theme.controlText,
                trailingIconColor: theme.accentStrong,
              }}
              key={option.value}
              onClick={() => {
                setExpanded(false);
                onChange(option.value);
              }}
            >
              <DropdownMenuItem.Text>
                <Text color={theme.controlText}>{option.label}</Text>
              </DropdownMenuItem.Text>
              {option.value === value ? (
                <DropdownMenuItem.TrailingIcon>
                  <Icon
                    contentDescription={undefined}
                    size={19}
                    source={checkIcon}
                    tint={theme.accentStrong}
                  />
                </DropdownMenuItem.TrailingIcon>
              ) : undefined}
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Row>
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
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <RowCopy
        description={description}
        disabled={disabled}
        theme={theme}
        title={title}
      />
      <Switch
        colors={{
          checkedTrackColor: theme.accent,
          uncheckedTrackColor: theme.panelMuted,
        }}
        enabled={!disabled}
        value={value}
        onCheckedChange={onChange}
      />
    </Row>
  );
}

export function LibraryNativeActionRow({
  description,
  disabled = false,
  loading = false,
  showsChevron = false,
  theme,
  title,
  tone = "default",
  value,
  onPress,
}: LibraryNativeActionRowProps) {
  const titleColor =
    tone === "danger"
      ? "#f44336"
      : tone === "accent"
        ? theme.accentStrong
        : theme.controlText;
  return (
    <Row
      verticalAlignment="center"
      modifiers={[
        fillMaxWidth(),
        ...(onPress && !disabled ? [clickable(onPress)] : []),
      ]}
    >
      <RowCopy
        description={description}
        disabled={disabled}
        theme={theme}
        title={title}
        titleColor={titleColor}
      />
      {value ? (
        <Text
          color={theme.secondaryText}
          maxLines={1}
          style={uiTypography.optionValue}
        >
          {value}
        </Text>
      ) : null}
      {loading ? (
        <CircularProgressIndicator
          color={theme.accentStrong}
          modifiers={[size(22, 22)]}
          strokeWidth={2.5}
        />
      ) : null}
      {showsChevron ? (
        <Icon
          contentDescription={undefined}
          size={19}
          source={chevronRightIcon}
          tint={theme.secondaryText}
        />
      ) : null}
    </Row>
  );
}
