import {
  DropdownMenu,
  DropdownMenuItem,
  FilledTonalIconButton,
  Host,
  Icon,
  Text,
} from "@expo/ui/jetpack-compose";
import { size } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { StyleSheet } from "react-native";

import checkIcon from "../assets/icons/check.xml";
import sortIcon from "../assets/icons/sort.xml";
import type { LibraryNativeSortControlProps } from "./library-native-sort-control.types";
import { uiSize } from "./ui-tokens";

export function LibraryNativeSortControl({
  accessibilityLabel,
  options,
  theme,
  value,
  onChange,
}: LibraryNativeSortControlProps) {
  const [expanded, setExpanded] = useState(false);
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
