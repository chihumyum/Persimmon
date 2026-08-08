import {
  Button,
  Host,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  lineLimit,
  padding,
  shapes,
  shadow,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import type { LibraryNativeSyncNoticeProps } from "./library-native-sync-notice.types";

const SYSTEM_IMAGES = {
  attention: "exclamationmark.icloud",
  cloud: "icloud",
  success: "checkmark.icloud",
  syncing: "arrow.triangle.2.circlepath.icloud",
} as const;

export function LibraryNativeSyncNotice({
  closeAccessibilityLabel,
  description,
  floating = false,
  kind,
  openAccessibilityLabel,
  progress,
  theme,
  title,
  onClose,
  onOpen,
}: LibraryNativeSyncNoticeProps) {
  const floatingShadowColor = `${theme.shadow}2e`;

  return (
    <View style={styles.container}>
      <Host
        colorScheme={theme.colorScheme}
        ignoreSafeArea="all"
        matchContents={{ vertical: true }}
        seedColor={theme.accent}
        style={styles.host}
      >
        <ZStack alignment="trailing">
          <Button
            modifiers={[
              buttonStyle("plain"),
              frame({ maxWidth: 10_000, minHeight: 60, alignment: "leading" }),
              padding({ horizontal: 8, vertical: 4 }),
              contentShape(
                shapes.roundedRectangle({
                  cornerRadius: 18,
                  roundedCornerStyle: "continuous",
                }),
              ),
              clipShape("roundedRectangle", 18),
              glassEffect({
                glass: {
                  interactive: true,
                  tint: theme.panel,
                  variant: "clear",
                },
                cornerRadius: 18,
                shape: "roundedRectangle",
              }),
              ...(floating
                ? [
                    shadow({
                      color: floatingShadowColor,
                      radius: 9,
                      x: 0,
                      y: 4,
                    }),
                  ]
                : []),
              accessibilityLabel(openAccessibilityLabel),
            ]}
            onPress={onOpen}
          >
            <HStack alignment="center" spacing={10}>
              {kind === "syncing" ? (
                <ProgressView />
              ) : (
                <Image
                  color={
                    kind === "attention" ? theme.noteAccent : theme.accentStrong
                  }
                  size={22}
                  systemName={SYSTEM_IMAGES[kind]}
                />
              )}
              <VStack alignment="leading" spacing={2}>
                <Text
                  modifiers={[
                    font({ size: 14, weight: "semibold" }),
                    foregroundStyle(theme.text),
                    lineLimit(1),
                  ]}
                >
                  {title}
                </Text>
                <Text
                  modifiers={[
                    font({ size: 12 }),
                    foregroundStyle(theme.secondaryText),
                    lineLimit(1),
                  ]}
                >
                  {description}
                </Text>
                {progress !== undefined ? (
                  <ProgressView
                    value={progress}
                    modifiers={[frame({ maxWidth: 10_000 })]}
                  />
                ) : null}
              </VStack>
              <Spacer />
              {onClose ? <Spacer modifiers={[frame({ width: 46 })]} /> : null}
            </HStack>
          </Button>
          {onClose ? (
            <Button
              label={closeAccessibilityLabel ?? "Close"}
              modifiers={[
                buttonStyle("plain"),
                labelStyle("iconOnly"),
                tint(theme.secondaryText),
                frame({ width: 44, height: 48 }),
                accessibilityLabel(closeAccessibilityLabel ?? "Close"),
                padding({ trailing: 8 }),
              ]}
              systemImage="xmark"
              onPress={onClose}
            />
          ) : null}
        </ZStack>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 60, width: "100%" },
  host: { minHeight: 60, width: "100%" },
});
