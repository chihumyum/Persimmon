import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

import type { AndroidReaderBackOptions } from "./use-android-reader-back";

export function useAndroidReaderBack({
  enabled = true,
  panelVisible,
  onBack,
  onClosePanels,
}: AndroidReaderBackOptions): void {
  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (panelVisible) {
          onClosePanels();
        } else {
          onBack();
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [enabled, onBack, onClosePanels, panelVisible]);
}
