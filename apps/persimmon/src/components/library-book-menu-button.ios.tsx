import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  contentShape,
  labelStyle,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import { iosNativeRoundControlModifiers } from "./ios-native-round-control";
import type { LibraryBookMenuButtonProps } from "./library-book-menu-button.types";
import { uiSize } from "./ui-tokens";

export function LibraryBookMenuButton({
  accessibilityLabel,
  canDelete,
  deleteLabel,
  detailsLabel,
  syncLabel,
  theme,
  onAction,
}: LibraryBookMenuButtonProps) {
  return (
    <View style={styles.frame}>
      <Host
        colorScheme={theme.colorScheme}
        ignoreSafeArea="all"
        matchContents
        seedColor={theme.accent}
      >
        <Menu
          label={
            <Image color={theme.controlText} size={20} systemName="ellipsis" />
          }
          modifiers={[
            ...iosNativeRoundControlModifiers({
              dimension: uiSize.minimumHitTarget,
              iconSize: 20,
              surface: "plain",
            }),
            contentShape(shapes.rectangle()),
            labelStyle("iconOnly"),
            tint(theme.controlText),
            accessibilityLabelModifier(accessibilityLabel),
          ]}
        >
          <Button
            label={detailsLabel}
            systemImage="info.circle"
            onPress={() => onAction("details")}
          />
          <Button
            label={syncLabel}
            systemImage="arrow.clockwise"
            onPress={() => onAction("sync")}
          />
          {canDelete ? (
            <Button
              label={deleteLabel}
              role="destructive"
              systemImage="trash"
              onPress={() => onAction("delete")}
            />
          ) : null}
        </Menu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    height: uiSize.minimumHitTarget,
    justifyContent: "center",
    width: uiSize.minimumHitTarget,
  },
});

export type { LibraryBookMenuButtonProps } from "./library-book-menu-button.types";
