import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UiButton } from "../components/ui-button";
import { UiModalSurface } from "../components/ui-modal-surface";
import { UiSegmentedControl } from "../components/ui-segmented-control";
import { uiBackdropColor } from "../components/ui-shadow";
import { UiText as Text } from "../components/ui-text";
import { uiRadius, uiSpace } from "../components/ui-tokens";
import type { ReaderColorMode } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";

const COLOR_MODE_OPTIONS: readonly {
  readonly value: ReaderColorMode;
  readonly label: string;
  readonly accessibilityLabel: string;
}[] = [
  { value: "system", label: "自动", accessibilityLabel: "自动颜色模式" },
  { value: "light", label: "浅色", accessibilityLabel: "浅色模式" },
  { value: "dark", label: "深色", accessibilityLabel: "深色模式" },
];

export function syncDescription(status: GoogleDriveSyncStatus): string {
  switch (status.phase) {
    case "loading":
      return "正在读取同步状态…";
    case "unconfigured":
      return status.message;
    case "disconnected":
      return "连接后会自动上传和下载 EPUB，并用稳定文本位置同步阅读进度。";
    case "authorizing":
      return "正在等待 Google 授权…";
    case "syncing":
      return status.accountEmail
        ? `正在与 ${status.accountEmail} 同步书架…`
        : "正在同步书架与阅读进度…";
    case "idle": {
      const time = new Date(status.lastSyncedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${status.accountEmail ?? "Google Drive"} · ${time} 已同步`;
    }
    case "reauthorization-required":
    case "error":
      return status.message;
  }
}

export interface LibrarySettingsModalProps {
  readonly colorMode: ReaderColorMode;
  readonly syncBannerVisible: boolean;
  readonly syncStatus: GoogleDriveSyncStatus;
  readonly theme: ReaderTheme;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onColorModeChange: (mode: ReaderColorMode) => void;
  readonly onConnectGoogleDrive: () => void;
  readonly onDisconnectGoogleDrive: () => void;
  readonly onSyncBannerVisibleChange: (visible: boolean) => void;
  readonly onSyncNow: () => void;
}

export function LibrarySettingsModal({
  colorMode,
  syncBannerVisible,
  syncStatus,
  theme,
  visible,
  onClose,
  onColorModeChange,
  onConnectGoogleDrive,
  onDisconnectGoogleDrive,
  onSyncBannerVisibleChange,
  onSyncNow,
}: LibrarySettingsModalProps) {
  const insets = useSafeAreaInsets();
  const busy =
    syncStatus.phase === "loading" ||
    syncStatus.phase === "authorizing" ||
    syncStatus.phase === "syncing";
  const canConnect =
    syncStatus.phase === "disconnected" ||
    syncStatus.phase === "reauthorization-required";
  const canSync = syncStatus.phase === "idle" || syncStatus.phase === "error";
  const canDisconnect =
    syncStatus.phase === "idle" ||
    syncStatus.phase === "syncing" ||
    syncStatus.phase === "error" ||
    syncStatus.phase === "reauthorization-required";

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.modalRoot,
          {
            backgroundColor: uiBackdropColor(theme),
            paddingBottom: Math.max(insets.bottom, 14),
            paddingTop: Math.max(insets.top, 14),
          },
        ]}
      >
        <Pressable
          accessibilityLabel="关闭设置"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <UiModalSurface theme={theme}>
          <View style={styles.header}>
            <Text variant="modalTitle" style={{ color: theme.text }}>
              设置
            </Text>
            <UiButton
              compact
              label="完成"
              onPress={onClose}
              textTone="accent"
              theme={theme}
              variant="ghost"
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.controlText }]}>
                外观
              </Text>
              <UiSegmentedControl
                accessibilityLabel="应用颜色模式"
                options={COLOR_MODE_OPTIONS}
                theme={theme}
                value={colorMode}
                onChange={onColorModeChange}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.section}>
              <View style={styles.syncHeading}>
                <View style={styles.syncHeadingCopy}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Google Drive
                  </Text>
                  <Text
                    style={[styles.sectionBody, { color: theme.secondaryText }]}
                  >
                    {syncDescription(syncStatus)}
                  </Text>
                </View>
                {busy ? (
                  <ActivityIndicator color={theme.accent} size="small" />
                ) : null}
              </View>

              <View style={styles.actionRow}>
                {canConnect ? (
                  <UiButton
                    label={
                      syncStatus.phase === "disconnected"
                        ? "连接 Google Drive"
                        : "重新连接"
                    }
                    onPress={onConnectGoogleDrive}
                    theme={theme}
                    variant="primary"
                  />
                ) : null}
                {canSync ? (
                  <UiButton
                    label="立即同步"
                    onPress={onSyncNow}
                    theme={theme}
                  />
                ) : null}
                {canDisconnect ? (
                  <UiButton
                    label="断开连接"
                    onPress={onDisconnectGoogleDrive}
                    textTone="muted"
                    theme={theme}
                    variant="ghost"
                  />
                ) : null}
              </View>

              <View
                style={[
                  styles.preferenceRow,
                  {
                    backgroundColor: theme.panelRaised,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.preferenceCopy}>
                  <Text
                    style={[
                      styles.preferenceTitle,
                      { color: theme.controlText },
                    ]}
                  >
                    在书架显示同步提示
                  </Text>
                  <Text
                    style={[
                      styles.preferenceBody,
                      { color: theme.secondaryText },
                    ]}
                  >
                    关闭后仍会在后台自动同步
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="在书架显示同步提示"
                  onValueChange={onSyncBannerVisibleChange}
                  thumbColor={
                    Platform.OS === "android" ? theme.panelRaised : undefined
                  }
                  trackColor={{
                    false: theme.panelMuted,
                    true: theme.accent,
                  }}
                  value={syncBannerVisible}
                />
              </View>
            </View>
          </ScrollView>
        </UiModalSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  content: {
    gap: 20,
    paddingBottom: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: uiSpace.lg,
  },
  modalRoot: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  preferenceBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  preferenceCopy: {
    flex: 1,
    paddingRight: 10,
  },
  preferenceRow: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    marginTop: 5,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  preferenceTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    gap: 12,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  syncHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  syncHeadingCopy: {
    flex: 1,
  },
});
