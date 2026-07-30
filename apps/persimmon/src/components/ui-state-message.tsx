import type { ReaderTheme } from "@persimmon/reader-skia";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { UiButton } from "./ui-button";
import { UiText } from "./ui-text";
import { uiRadius, uiSpace } from "./ui-tokens";

export interface UiEmptyStateProps {
  readonly body: string;
  readonly theme: ReaderTheme;
  readonly title: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function UiEmptyState({ body, style, theme, title }: UiEmptyStateProps) {
  return (
    <View style={[styles.empty, style]}>
      <UiText variant="sectionTitle" style={{ color: theme.text }}>
        {title}
      </UiText>
      <UiText variant="body" style={{ color: theme.secondaryText }}>
        {body}
      </UiText>
    </View>
  );
}

export interface UiInlineAlertProps {
  readonly actionLabel: string;
  readonly message: string;
  readonly theme: ReaderTheme;
  readonly onAction: () => void;
}

export function UiInlineAlert({
  actionLabel,
  message,
  onAction,
  theme,
}: UiInlineAlertProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.alert,
        {
          backgroundColor: theme.panel,
          borderColor: theme.noteAccent,
        },
      ]}
    >
      <UiText
        variant="body"
        style={[styles.alertMessage, { color: theme.text }]}
      >
        {message}
      </UiText>
      <UiButton
        compact
        label={actionLabel}
        onPress={onAction}
        textTone="accent"
        theme={theme}
        variant="ghost"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    alignItems: "center",
    borderRadius: uiRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: uiSpace.md,
    marginBottom: uiSpace.lg + uiSpace.xxs,
    paddingHorizontal: uiSpace.lg,
    paddingVertical: uiSpace.sm,
  },
  alertMessage: {
    flex: 1,
  },
  empty: {
    alignItems: "center",
    gap: uiSpace.xs,
    paddingVertical: 52,
  },
});
