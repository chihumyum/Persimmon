import type { ReaderTheme } from "@persimmon/reader-skia";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { UiIcon, type UiIconName } from "./ui-icon";
import { UiText } from "./ui-text";
import { uiRadius, uiSize } from "./ui-tokens";

export type UiButtonVariant = "primary" | "secondary" | "ghost" | "chrome";

export interface UiButtonProps
  extends Omit<PressableProps, "children" | "style"> {
  readonly label: string;
  readonly theme: ReaderTheme;
  readonly variant?: UiButtonVariant;
  readonly textTone?: "default" | "accent" | "muted" | "danger";
  readonly compact?: boolean;
  readonly loading?: boolean;
  readonly iconOnly?: boolean;
  readonly leadingIcon?: UiIconName;
  readonly trailingIcon?: UiIconName;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
}

export function UiButton({
  accessibilityLabel,
  compact = false,
  disabled,
  hitSlop,
  iconOnly = false,
  label,
  leadingIcon,
  loading = false,
  style,
  textStyle,
  textTone = "default",
  theme,
  trailingIcon,
  variant = "secondary",
  ...props
}: UiButtonProps) {
  const primary = variant === "primary";
  const chrome = variant === "chrome";
  const ghost = variant === "ghost";
  const iconSize = chrome ? 19 : compact ? 17 : 19;
  const textColor = primary
    ? theme.panelRaised
    : textTone === "accent"
      ? theme.accentStrong
      : textTone === "muted"
        ? theme.secondaryText
        : textTone === "danger"
          ? theme.noteAccent
          : theme.controlText;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={props.accessibilityRole ?? "button"}
      accessibilityState={{
        ...props.accessibilityState,
        busy: loading || props.accessibilityState?.busy,
        disabled: disabled || loading || props.accessibilityState?.disabled,
      }}
      disabled={disabled || loading}
      hitSlop={
        hitSlop ??
        (chrome
          ? uiSize.readerChromeHitSlop
          : compact
            ? uiSize.compactControlHitSlop
            : undefined)
      }
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        chrome && styles.chrome,
        ghost && styles.ghost,
        iconOnly &&
          (chrome
            ? styles.iconOnlyChrome
            : compact
              ? styles.iconOnlyCompact
              : styles.iconOnlyRegular),
        {
          backgroundColor: primary
            ? theme.accent
            : ghost
              ? "transparent"
              : chrome
                ? "transparent"
                : theme.panelRaised,
          borderColor:
            primary || ghost || chrome ? "transparent" : theme.border,
        },
        pressed && {
          backgroundColor: primary
            ? theme.accentStrong
            : chrome
              ? `${theme.panelMuted}b8`
              : theme.panelMuted,
          transform: [{ scale: chrome ? 0.94 : 0.97 }],
        },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.content}>
          {leadingIcon ? (
            <UiIcon color={textColor} name={leadingIcon} size={iconSize} />
          ) : null}
          {!iconOnly ? (
            <UiText variant="button" style={[{ color: textColor }, textStyle]}>
              {label}
            </UiText>
          ) : null}
          {trailingIcon ? (
            <UiIcon color={textColor} name={trailingIcon} size={iconSize} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: uiRadius.control,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  chrome: {
    borderRadius: uiRadius.pill,
    borderWidth: 0,
    height: uiSize.readerChrome,
    minHeight: uiSize.readerChrome,
    minWidth: 42,
    paddingHorizontal: 10,
  },
  compact: {
    minHeight: uiSize.compactControl,
    paddingHorizontal: 12,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.46,
  },
  ghost: {
    paddingHorizontal: 5,
  },
  iconOnlyChrome: {
    borderRadius: uiRadius.pill,
    height: uiSize.readerChrome,
    paddingHorizontal: 0,
    width: uiSize.readerChrome,
  },
  iconOnlyCompact: {
    borderRadius: uiRadius.pill,
    height: uiSize.compactControl,
    paddingHorizontal: 0,
    width: uiSize.compactControl,
  },
  iconOnlyRegular: {
    borderRadius: uiRadius.pill,
    height: uiSize.minimumHitTarget,
    paddingHorizontal: 0,
    width: uiSize.minimumHitTarget,
  },
  regular: {
    minHeight: uiSize.minimumHitTarget,
    paddingHorizontal: 16,
  },
});
