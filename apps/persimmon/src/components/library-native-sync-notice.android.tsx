import {
  CircularProgressIndicator,
  Column,
  ElevatedCard,
  Host,
  Icon,
  IconButton,
  LinearProgressIndicator,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet, View } from "react-native";

import checkIcon from "../assets/icons/check.xml";
import closeIcon from "../assets/icons/close.xml";
import cloudIcon from "../assets/icons/cloud.xml";
import syncIcon from "../assets/icons/sync.xml";
import type { LibraryNativeSyncNoticeProps } from "./library-native-sync-notice.types";

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
  const icon =
    kind === "success" ? checkIcon : kind === "syncing" ? syncIcon : cloudIcon;
  return (
    <View style={styles.container}>
      <Host
        colorScheme={theme.colorScheme}
        matchContents={{ vertical: true }}
        seedColor={theme.accent}
        style={styles.host}
      >
        <ElevatedCard
          colors={{
            containerColor: theme.panelRaised,
            contentColor: theme.controlText,
          }}
          elevation={floating ? 5 : 1}
          modifiers={[
            fillMaxWidth(),
            clip(Shapes.RoundedCorner(12)),
            clickable(onOpen),
          ]}
        >
          <Row
            verticalAlignment="center"
            modifiers={[fillMaxWidth(), padding(8, 7, 8, 7)]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[weight(1), padding(7, 5, 7, 5)]}
            >
              {kind === "syncing" ? (
                <CircularProgressIndicator
                  color={theme.accentStrong}
                  modifiers={[size(24, 24)]}
                  strokeWidth={2.5}
                />
              ) : (
                <Icon
                  contentDescription={openAccessibilityLabel}
                  size={24}
                  source={icon}
                  tint={
                    kind === "attention" ? theme.noteAccent : theme.accentStrong
                  }
                />
              )}
              <Column
                modifiers={[weight(1)]}
                verticalArrangement={{ spacedBy: 2 }}
              >
                <Text
                  color={theme.text}
                  maxLines={1}
                  style={{ fontSize: 15, fontWeight: "600" }}
                >
                  {title}
                </Text>
                <Text
                  color={theme.secondaryText}
                  maxLines={2}
                  style={{ fontSize: 13 }}
                >
                  {description}
                </Text>
                {progress !== undefined ? (
                  <LinearProgressIndicator
                    color={theme.accentStrong}
                    progress={progress}
                    trackColor={theme.panelMuted}
                    modifiers={[fillMaxWidth()]}
                  />
                ) : null}
              </Column>
            </Row>
            {onClose ? (
              <IconButton modifiers={[size(44, 44)]} onClick={onClose}>
                <Icon
                  contentDescription={closeAccessibilityLabel}
                  size={21}
                  source={closeIcon}
                  tint={theme.secondaryText}
                />
              </IconButton>
            ) : null}
          </Row>
        </ElevatedCard>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 76, width: "100%" },
  host: { minHeight: 76, width: "100%" },
});
