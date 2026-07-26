import { requireNativeModule } from "expo";
import { Platform } from "react-native";

export interface SelectionMenuRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface PersimmonSelectionMenuNativeModule {
  show(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void>;
  hide(): Promise<void>;
}

const nativeModule =
  Platform.OS === "web"
    ? null
    : requireNativeModule<PersimmonSelectionMenuNativeModule>(
        "PersimmonSelectionMenu",
      );

export async function showSelectionMenu(
  text: string,
  rect: SelectionMenuRect,
): Promise<void> {
  await nativeModule?.show(text, rect.x, rect.y, rect.width, rect.height);
}

export async function hideSelectionMenu(): Promise<void> {
  await nativeModule?.hide();
}
