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
  readonly incomingLandingStartProgress?: number;
  readonly incomingRevealStartProgress?: number;
  readonly incomingRevealEndProgress?: number;
  readonly incomingDragProgressScale?: number;
  readonly incomingDragProgressExponent?: number;
  readonly incomingSettleDurationSeconds?: number;
  readonly incomingSettleEasingPower?: number;
  readonly incomingRevertDurationSeconds?: number;
}

export interface NativePagerMotionConfig {
  readonly automatic: NativePagerDirectionalMotionTuning;
  readonly rapid: NativePagerDirectionalMotionTuning;
  readonly gesture: NativePagerDirectionalMotionTuning;
}

export interface NativePagerDirectionalMotionTuning {
  readonly forward: NativePagerMotionTuning;
  readonly backward: NativePagerMotionTuning;
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
  readonly rapidDurationMs: number;
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
  readonly idleDecaySeconds: number;
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

export * from "./native-pager-compositor.native";
