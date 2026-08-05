import {
  FilledTonalIconButton,
  Host,
  Icon,
  Row,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  padding,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet } from "react-native";

import backIcon from "../assets/icons/back.xml";
import closeIcon from "../assets/icons/close.xml";
import type { LibraryNativeSheetHeaderProps } from "./library-native-sheet-header.types";
import { uiSize, uiTypography } from "./ui-tokens";

export function LibraryNativeSheetHeader({
  backAccessibilityLabel,
  closeAccessibilityLabel,
  theme,
  title,
  onBack,
  onClose,
}: LibraryNativeSheetHeaderProps) {
  const colors = {
    containerColor: theme.panelRaised,
    contentColor: theme.controlText,
  };
  return (
    <Host
      colorScheme={theme.colorScheme}
      seedColor={theme.accent}
      style={styles.host}
    >
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          height(uiSize.sheetHeader),
          padding(
            uiSize.optionHorizontalInset,
            uiSize.sheetHeaderInset,
            uiSize.optionHorizontalInset,
            uiSize.sheetHeaderInset,
          ),
        ]}
      >
        {onBack ? (
          <FilledTonalIconButton
            colors={colors}
            modifiers={[size(uiSize.control, uiSize.control)]}
            onClick={onBack}
          >
            <Icon
              contentDescription={backAccessibilityLabel ?? title}
              size={uiSize.controlIcon}
              source={backIcon}
              tint={theme.controlText}
            />
          </FilledTonalIconButton>
        ) : (
          <Spacer modifiers={[size(uiSize.control, uiSize.control)]} />
        )}
        <Text
          color={theme.text}
          maxLines={1}
          modifiers={[weight(1)]}
          style={{ ...uiTypography.sheetHeader, textAlign: "center" }}
        >
          {title}
        </Text>
        <FilledTonalIconButton
          colors={colors}
          modifiers={[size(uiSize.control, uiSize.control)]}
          onClick={onClose}
        >
          <Icon
            contentDescription={closeAccessibilityLabel}
            size={uiSize.controlIcon}
            source={closeIcon}
            tint={theme.controlText}
          />
        </FilledTonalIconButton>
      </Row>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    height: uiSize.sheetHeader,
    width: "100%",
  },
});
