import { requireOptionalNativeModule } from "expo";
import { useEffect, useSyncExternalStore } from "react";
import { Platform, StatusBar } from "react-native";

export type AppStatusBarStyle = "light-content" | "dark-content";

interface PersimmonStatusBarNativeModule {
  setAppearance(hidden: boolean, style: AppStatusBarStyle): Promise<void>;
}

const NativeStatusBar =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<PersimmonStatusBarNativeModule>(
        "PersimmonStatusBar",
      )
    : null;

// The full-screen surface that owns the status bar right now. Sheets read it
// because a sheet in a compact window takes over the status bar and has to
// repeat this preference to keep it hidden.
let statusBarHidden = false;
const statusBarListeners = new Set<() => void>();

function setStatusBarHidden(hidden: boolean) {
  if (statusBarHidden === hidden) {
    return;
  }
  statusBarHidden = hidden;
  statusBarListeners.forEach((listener) => listener());
}

function subscribeToStatusBar(listener: () => void) {
  statusBarListeners.add(listener);
  return () => {
    statusBarListeners.delete(listener);
  };
}

/** Whether the current full-screen surface hides the status bar. */
export function useAppStatusBarHidden(): boolean {
  return useSyncExternalStore(
    subscribeToStatusBar,
    () => statusBarHidden,
    () => false,
  );
}

export interface AppStatusBarProps {
  readonly barStyle: AppStatusBarStyle;
  readonly hidden?: boolean;
}

/**
 * The status bar for one full-screen surface. On iOS it drives the native
 * root view controller, because iOS 27 ignores React Native's `StatusBar`;
 * Android keeps the translucent React Native status bar.
 */
export function AppStatusBar({ barStyle, hidden = false }: AppStatusBarProps) {
  useEffect(() => {
    setStatusBarHidden(hidden);
    void NativeStatusBar?.setAppearance(hidden, barStyle);
  }, [barStyle, hidden]);

  if (NativeStatusBar) {
    return null;
  }
  return (
    <StatusBar
      backgroundColor="transparent"
      barStyle={barStyle}
      hidden={hidden}
      translucent
    />
  );
}
