import type { SkImage, SkPicture } from "@shopify/react-native-skia";

export type NativePagerEvent =
  | "consumed"
  | "started"
  | "completed"
  | "stock-miss";

export interface NativePagerEventRecord {
  readonly id: string;
  readonly event: NativePagerEvent;
  readonly eventAtMs: number;
  readonly direction?: 1 | -1;
}

export interface NativePagerCanvasHandle {
  getNativeId(): number;
}

export interface NativePagerTurnCommand {
  readonly id: string;
  readonly frontImage: SkImage;
  readonly backImage?: SkImage;
  readonly direction: 1 | -1;
  readonly spread: boolean;
  readonly startAtMs: number;
  readonly durationMs: number;
  readonly launchIntervalMs: number;
  readonly paperColor: number;
}

export interface NativePagerPictureTurnCommand {
  readonly id: string;
  readonly frontPicture: SkPicture;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly direction: 1 | -1;
  readonly spread: boolean;
  readonly startAtMs: number;
  readonly durationMs: number;
  readonly launchIntervalMs: number;
  readonly paperColor: number;
}

export interface NativePagerStockPictureCommand {
  readonly id: string;
  readonly fromPageKey: string;
  readonly toPageKey: string;
  readonly frontPicture: SkPicture;
  readonly backgroundPicture: SkPicture;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly direction: 1 | -1;
  readonly contentRevision: number;
  readonly durationMs: number;
  readonly launchIntervalMs: number;
  readonly paperColor: number;
}

export function nativePagerCompositorAvailable(): boolean {
  return false;
}

export function enqueueNativePagerTurn(
  _canvas: NativePagerCanvasHandle | null,
  _command: NativePagerTurnCommand,
): boolean {
  return false;
}

export function enqueueNativePagerPictureTurn(
  _canvas: NativePagerCanvasHandle | null,
  _command: NativePagerPictureTurnCommand,
): boolean {
  return false;
}

export function preloadNativePagerImage(
  _canvas: NativePagerCanvasHandle | null,
  _image: SkImage,
): boolean {
  return false;
}

export function setNativePagerAnchor(
  _canvas: NativePagerCanvasHandle | null,
  _pageKey: string,
): boolean {
  return false;
}

export function stockNativePagerPicture(
  _canvas: NativePagerCanvasHandle | null,
  _command: NativePagerStockPictureCommand,
): boolean {
  return false;
}

export function configureNativePagerInput(
  _canvas: NativePagerCanvasHandle | null,
  _enabled: boolean,
): boolean {
  return false;
}

export function consumeNativePagerInputOnUI(
  _nativeId: number,
  _direction: 1 | -1,
): boolean | undefined {
  return undefined;
}

export function runNativePagerBenchmark(
  _canvas: NativePagerCanvasHandle | null,
  _count: number,
  _intervalMs: number,
  _direction: 1 | -1,
): boolean {
  return false;
}

export function takeNativePagerEvents(
  _canvas: NativePagerCanvasHandle | null,
): readonly NativePagerEventRecord[] {
  return [];
}

export function resetNativePagerCompositor(
  _canvas: NativePagerCanvasHandle | null,
): void {}
