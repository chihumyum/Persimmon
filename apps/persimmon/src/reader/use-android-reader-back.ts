export interface AndroidReaderBackOptions {
  readonly panelVisible: boolean;
  readonly onBack: () => void;
  readonly onClosePanels: () => void;
}

export function useAndroidReaderBack(
  _options: AndroidReaderBackOptions,
): void {}
