import { Pressable, StyleSheet, View } from "react-native";

import { UiIcon } from "./ui-icon";
import { UiText as Text } from "./ui-text";
import type { LibraryNativeSyncNoticeProps } from "./library-native-sync-notice.types";

export function LibraryNativeSyncNotice({
  description,
  theme,
  title,
  onOpen,
}: LibraryNativeSyncNoticeProps) {
  return (
    <Pressable
      onPress={onOpen}
      style={[styles.notice, { backgroundColor: theme.panelRaised }]}
    >
      <UiIcon color={theme.accentStrong} name="cloud" size={21} />
      <View style={styles.copy}>
        <Text style={{ color: theme.text, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: theme.secondaryText }}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  notice: {
    alignItems: "center",
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    padding: 12,
  },
});

export type { LibraryNativeSyncNoticeProps } from "./library-native-sync-notice.types";
