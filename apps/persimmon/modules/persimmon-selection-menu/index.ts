import { requireNativeModule } from "expo";
import { Platform } from "react-native";

export interface SelectionMenuRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type BookMenuRect = SelectionMenuRect;

export type BookMenuAction = "details" | "sync" | "delete";

interface PersimmonSelectionMenuNativeModule {
  show(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void>;
  showBookMenu(
    labels: readonly [details: string, sync: string, deleteLabel: string],
    canDelete: boolean,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<BookMenuAction | null>;
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

export async function showBookMenu(
  detailsLabel: string,
  syncLabel: string,
  deleteLabel: string,
  canDelete: boolean,
  rect: BookMenuRect,
): Promise<BookMenuAction | undefined> {
  if (!nativeModule) {
    return undefined;
  }
  return (
    (await nativeModule.showBookMenu(
      [detailsLabel, syncLabel, deleteLabel],
      canDelete,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    )) ?? undefined
  );
}
