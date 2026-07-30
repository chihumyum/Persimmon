import type { SkImage, SkPicture } from "@shopify/react-native-skia";

export type NativePagerEvent =
  | "consumed"
  | "started"
  | "gesture-started"
  | "gesture-released"
  | "completed"
  | "cancelled"
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

export interface NativePagerMotionTuning {
  readonly releaseX: number;
  readonly liftVelocity: number;
  readonly liftToLeft: number;
  readonly curvatureRelaxation: number;
}

export interface NativePagerMotionConfig {
  readonly automatic: NativePagerMotionTuning;
  readonly gesture: NativePagerMotionTuning;
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
  readonly backPicture?: SkPicture;
  readonly backgroundLeftPicture?: SkPicture;
  readonly backgroundRightPicture?: SkPicture;
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
  readonly frontPageKey: string;
  readonly backPageKey?: string;
  readonly backgroundLeftPageKey?: string;
  readonly backgroundRightPageKey?: string;
  readonly frontPicture: SkPicture;
  readonly backPicture?: SkPicture;
  readonly backgroundLeftPicture?: SkPicture;
  readonly backgroundRightPicture?: SkPicture;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly direction: 1 | -1;
  readonly spread: boolean;
  readonly contentRevision: number;
  readonly durationMs: number;
  readonly launchIntervalMs: number;
  readonly paperColor: number;
}

export interface NativePagerGestureRelease {
  readonly fingerX: number;
  readonly throwVelocity: number;
  readonly throwAcceleration: number;
  readonly pageWeight: number;
  readonly commitThreshold: number;
  readonly slowCommitEdgeX: number;
  readonly minimumSpeedScale: number;
  readonly maximumSpeedScale: number;
  readonly velocityGain: number;
}

export interface NativePagerGestureStart {
  readonly direction: 1 | -1;
  readonly startBookX: number;
  readonly fingerX: number;
  readonly turnProgress: number;
}

export interface NativePagerGestureUpdate {
  readonly fingerX: number;
  readonly turnProgress: number;
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

export function configureNativePagerMotion(
  _canvas: NativePagerCanvasHandle | null,
  _config: NativePagerMotionConfig,
): boolean {
  return false;
}

export function consumeNativePagerInputOnUI(
  _nativeId: number,
  _direction: 1 | -1,
): boolean | undefined {
  return undefined;
}

export function beginNativePagerGestureOnUI(
  _nativeId: number,
  _start: NativePagerGestureStart,
): boolean | undefined {
  return undefined;
}

export function updateNativePagerGestureOnUI(
  _nativeId: number,
  _update: NativePagerGestureUpdate,
): boolean | undefined {
  return undefined;
}

export function endNativePagerGestureOnUI(
  _nativeId: number,
  _release: NativePagerGestureRelease,
): boolean | undefined {
  return undefined;
}

export function cancelNativePagerGestureOnUI(
  _nativeId: number,
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
