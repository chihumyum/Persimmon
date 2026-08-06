export interface AndroidReaderBackOptions {
  readonly enabled?: boolean;
  readonly panelVisible: boolean;
  readonly onBack: () => void;
  readonly onClosePanels: () => void;
}

export { useAndroidReaderBack } from "./use-android-reader-back.native";
