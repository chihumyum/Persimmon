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

import { UiText as Text } from "../components/ui-text";
import type { ReaderColorMode } from "../library/types";
import type { GoogleDriveSyncStatus } from "../sync/types";

const COLOR_MODE_OPTIONS: readonly {
  readonly value: ReaderColorMode;
  readonly label: string;
}[] = [
  { value: "system", label: "自动" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
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

function SegmentedOption({
  label,
  selected,
  theme,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly theme: ReaderTheme;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.segmentedOption,
        selected && {
          backgroundColor: theme.panelRaised,
          borderColor: theme.accent,
        },
      ]}
    >
      <Text
        style={[
          styles.segmentedOptionText,
          { color: selected ? theme.accentStrong : theme.secondaryText },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
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
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.panel,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>设置</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.doneButton}
            >
              <Text style={[styles.doneText, { color: theme.accentStrong }]}>
                完成
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.controlText }]}>
                外观
              </Text>
              <View
                accessibilityLabel="应用颜色模式"
                accessibilityRole="radiogroup"
                style={[
                  styles.segmentedControl,
                  { backgroundColor: theme.panelMuted },
                ]}
              >
                {COLOR_MODE_OPTIONS.map((option) => (
                  <SegmentedOption
                    key={option.value}
                    label={option.label}
                    selected={colorMode === option.value}
                    theme={theme}
                    onPress={() => onColorModeChange(option.value)}
                  />
                ))}
              </View>
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
                  <Pressable
                    accessibilityRole="button"
                    onPress={onConnectGoogleDrive}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { color: theme.panelRaised },
                      ]}
                    >
                      {syncStatus.phase === "disconnected"
                        ? "连接 Google Drive"
                        : "重新连接"}
                    </Text>
                  </Pressable>
                ) : null}
                {canSync ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onSyncNow}
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: theme.panelRaised,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: theme.controlText },
                      ]}
                    >
                      立即同步
                    </Text>
                  </Pressable>
                ) : null}
                {canDisconnect ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onDisconnectGoogleDrive}
                    style={styles.textButton}
                  >
                    <Text
                      style={[
                        styles.textButtonText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      断开连接
                    </Text>
                  </Pressable>
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
        </View>
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
  doneButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 3,
  },
  doneText: {
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalRoot: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  panel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "86%",
    maxWidth: 500,
    padding: 20,
    width: "100%",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 22px 70px rgba(0, 0, 0, 0.28)" }
      : {
          elevation: 14,
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.26,
          shadowRadius: 32,
        }),
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
    borderRadius: 14,
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
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 15,
  },
  secondaryButtonText: {
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
  segmentedControl: {
    borderRadius: 13,
    flexDirection: "row",
    padding: 3,
  },
  segmentedOption: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  segmentedOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  syncHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  syncHeadingCopy: {
    flex: 1,
  },
  textButton: {
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 5,
  },
  textButtonText: {
    fontSize: 12,
  },
  title: {
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.45,
  },
});
