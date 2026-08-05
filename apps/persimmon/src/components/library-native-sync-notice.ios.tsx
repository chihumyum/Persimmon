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
  font,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  lineLimit,
  padding,
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
  return (
    <View style={styles.container}>
      <Host
        colorScheme={theme.colorScheme}
        ignoreSafeArea="all"
        matchContents={{ vertical: true }}
        seedColor={theme.accent}
        style={styles.host}
      >
        <HStack
          alignment="center"
          spacing={4}
          modifiers={[
            frame({ maxWidth: 10_000, minHeight: 72 }),
            padding({ horizontal: 8, vertical: 7 }),
            glassEffect({
              glass: {
                interactive: true,
                tint: theme.panel,
                variant: "regular",
              },
              cornerRadius: 22,
              shape: "roundedRectangle",
            }),
            ...(floating
              ? [shadow({ color: theme.shadow, radius: 18, x: 0, y: 8 })]
              : []),
          ]}
        >
          <Button
            modifiers={[
              buttonStyle("plain"),
              frame({ maxWidth: 10_000, minHeight: 58, alignment: "leading" }),
              accessibilityLabel(openAccessibilityLabel),
            ]}
            onPress={onOpen}
          >
            <HStack alignment="center" spacing={12}>
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
                    font({ size: 15, weight: "semibold" }),
                    foregroundStyle(theme.text),
                    lineLimit(1),
                  ]}
                >
                  {title}
                </Text>
                <Text
                  modifiers={[
                    font({ size: 13 }),
                    foregroundStyle(theme.secondaryText),
                    lineLimit(2),
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
            </HStack>
          </Button>
          {onClose ? (
            <Button
              label={closeAccessibilityLabel ?? "Close"}
              modifiers={[
                buttonStyle("plain"),
                labelStyle("iconOnly"),
                tint(theme.secondaryText),
                frame({ width: 44, height: 52 }),
                accessibilityLabel(closeAccessibilityLabel ?? "Close"),
              ]}
              systemImage="xmark"
              onPress={onClose}
            />
          ) : null}
        </HStack>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 72, width: "100%" },
  host: { minHeight: 72, width: "100%" },
});
