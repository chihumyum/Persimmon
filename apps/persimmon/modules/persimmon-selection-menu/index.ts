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

export interface TableOfContentsPresentation {
  readonly title: string;
  readonly closeLabel: string;
  readonly labels: readonly string[];
  readonly depths: readonly number[];
  readonly selectedIndex: number;
  readonly colors: readonly [
    background: number,
    raised: number,
    text: number,
    secondaryText: number,
    accent: number,
    selected: number,
  ];
  readonly bottomInset: number;
}

interface PersimmonSelectionMenuNativeModule {
  show(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void>;
  showBookMenu(
    labels: readonly [
      details: string,
      sync: string,
      deleteLabel: string,
      cancelLabel: string,
    ],
    canDelete: boolean,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<BookMenuAction | null>;
  showTableOfContents(
    title: string,
    closeLabel: string,
    labels: readonly string[],
    depths: readonly number[],
    selectedIndex: number,
    colors: TableOfContentsPresentation["colors"],
    bottomInset: number,
  ): Promise<number | null>;
  hideTableOfContents(): Promise<void>;
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
  cancelLabel: string,
  canDelete: boolean,
  rect: BookMenuRect,
): Promise<BookMenuAction | undefined> {
  if (!nativeModule) {
    return undefined;
  }
  return (
    (await nativeModule.showBookMenu(
      [detailsLabel, syncLabel, deleteLabel, cancelLabel],
      canDelete,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    )) ?? undefined
  );
}

export async function showTableOfContents(
  presentation: TableOfContentsPresentation,
): Promise<number | undefined> {
  if (!nativeModule) {
    return undefined;
  }
  return (
    (await nativeModule.showTableOfContents(
      presentation.title,
      presentation.closeLabel,
      presentation.labels,
      presentation.depths,
      presentation.selectedIndex,
      presentation.colors,
      presentation.bottomInset,
    )) ?? undefined
  );
}

export async function hideTableOfContents(): Promise<void> {
  await nativeModule?.hideTableOfContents();
}
