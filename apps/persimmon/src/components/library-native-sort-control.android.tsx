import {
  DropdownMenu,
  DropdownMenuItem,
  FilledTonalButton,
  FilledTonalIconButton,
  Host,
  Icon,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import { height, size } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { StyleSheet } from "react-native";

import checkIcon from "../assets/icons/check.xml";
import chevronDownIcon from "../assets/icons/chevron_down.xml";
import sortIcon from "../assets/icons/sort.xml";
import type { LibraryNativeSortControlProps } from "./library-native-sort-control.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeSortControl({
  accessibilityLabel,
  iconOnly,
  options,
  theme,
  value,
  onChange,
}: LibraryNativeSortControlProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);
  const colors = {
    containerColor: theme.panelRaised,
    contentColor: theme.controlText,
  };
  return (
    <Host
      colorScheme={theme.colorScheme}
      matchContents
      seedColor={theme.accent}
      style={styles.host}
    >
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
      >
        <DropdownMenu.Trigger>
          {iconOnly ? (
            <FilledTonalIconButton
              colors={colors}
              modifiers={[size(uiSize.control, uiSize.control)]}
              onClick={() => setExpanded(true)}
            >
              <Icon
                contentDescription={accessibilityLabel}
                size={uiSize.controlIcon}
                source={sortIcon}
                tint={theme.controlText}
              />
            </FilledTonalIconButton>
          ) : (
            <FilledTonalButton
              colors={colors}
              contentPadding={{ bottom: 11, end: 14, start: 14, top: 11 }}
              modifiers={[height(uiSize.control)]}
              onClick={() => setExpanded(true)}
            >
              <Row
                horizontalArrangement={{ spacedBy: 7 }}
                verticalAlignment="center"
              >
                <Icon
                  contentDescription={accessibilityLabel}
                  size={20}
                  source={sortIcon}
                  tint={theme.controlText}
                />
                <Text
                  color={theme.controlText}
                  style={uiTypography.optionValue}
                >
                  {selected?.label ?? ""}
                </Text>
                <Icon
                  contentDescription={undefined}
                  size={17}
                  source={chevronDownIcon}
                  tint={theme.secondaryText}
                />
              </Row>
            </FilledTonalButton>
          )}
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
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { minHeight: uiSize.control },
});
