export interface AndroidReaderBackOptions {
  readonly enabled?: boolean;
  readonly panelVisible: boolean;
  readonly onBack: () => void;
  readonly onClosePanels: () => void;
}

export function useAndroidReaderBack(
  _options: AndroidReaderBackOptions,
): void {}
