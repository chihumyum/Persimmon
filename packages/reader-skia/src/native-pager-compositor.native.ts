import type { SkImage, SkPicture } from "@shopify/react-native-skia";

import type {
  NativePagerCanvasHandle,
  NativePagerEventRecord,
  NativePagerGestureRelease,
  NativePagerGestureStart,
  NativePagerGestureUpdate,
  NativePagerMotionConfig,
  NativePagerPictureTurnCommand,
  NativePagerStockPictureCommand,
  NativePagerTurnCommand,
} from "./native-pager-compositor";

interface NativePagerSkiaViewApi {
  pagerProtocolVersion?: () => number;
  pagerPreload?: (nativeId: number, image: SkImage) => void;
  pagerEnqueue?: (
    nativeId: number,
    turnId: string,
    frontImage: SkImage,
    backImage: SkImage | null,
    direction: 1 | -1,
    spread: boolean,
    startAtMs: number,
    durationMs: number,
    launchIntervalMs: number,
    paperColor: number,
  ) => void;
  pagerEnqueuePicture?: (
    nativeId: number,
    turnId: string,
    frontPicture: SkPicture,
    backPicture: SkPicture | null,
    backgroundLeftPicture: SkPicture | null,
    backgroundRightPicture: SkPicture | null,
    pixelWidth: number,
    pixelHeight: number,
    direction: 1 | -1,
    spread: boolean,
    startAtMs: number,
    durationMs: number,
    launchIntervalMs: number,
    paperColor: number,
  ) => void;
  pagerSetAnchor?: (nativeId: number, pageKey: string) => void;
  pagerStockPicture?: (
    nativeId: number,
    entryId: string,
    fromPageKey: string,
    toPageKey: string,
    frontPageKey: string,
    backPageKey: string | null,
    backgroundLeftPageKey: string | null,
    backgroundRightPageKey: string | null,
    frontPicture: SkPicture,
    backPicture: SkPicture | null,
    backgroundLeftPicture: SkPicture | null,
    backgroundRightPicture: SkPicture | null,
    pixelWidth: number,
    pixelHeight: number,
    direction: 1 | -1,
    spread: boolean,
    contentRevision: number,
    durationMs: number,
    launchIntervalMs: number,
    paperColor: number,
  ) => void;
  pagerSetInputEnabled?: (nativeId: number, enabled: boolean) => void;
  pagerConfigureMotion?: (
    nativeId: number,
    automaticReleaseX: number,
    automaticLiftVelocity: number,
    automaticLiftToLeft: number,
    automaticCurvatureRelaxation: number,
    gestureReleaseX: number,
    gestureLiftVelocity: number,
    gestureLiftToLeft: number,
    gestureCurvatureRelaxation: number,
  ) => void;
  pagerConsumeInput?: (nativeId: number, direction: 1 | -1) => boolean;
  pagerBeginGesture?: (
    nativeId: number,
    direction: 1 | -1,
    startBookX: number,
    fingerX: number,
    turnProgress: number,
  ) => boolean;
  pagerUpdateGesture?: (
    nativeId: number,
    fingerX: number,
    turnProgress: number,
  ) => boolean;
  pagerEndGesture?: (
    nativeId: number,
    fingerX: number,
    throwVelocity: number,
    throwAcceleration: number,
    pageWeight: number,
    commitThreshold: number,
    slowCommitEdgeX: number,
    minimumSpeedScale: number,
    maximumSpeedScale: number,
    velocityGain: number,
  ) => boolean;
  pagerCancelGesture?: (nativeId: number) => boolean;
  pagerRunBenchmark?: (
    nativeId: number,
    count: number,
    intervalMs: number,
    direction: 1 | -1,
  ) => void;
  pagerTakeEvents?: (nativeId: number) => readonly NativePagerEventRecord[];
  pagerReset?: (nativeId: number) => void;
}

// Match Skia's own Reanimated container: capture the JSI HostObject from the
// RN runtime so Worklets can serialize the reference into the UI runtime.
// Looking it up through globalThis inside a strict worklet is not reliable.
const nativePagerWorkletApi = (
  globalThis as typeof globalThis & {
    SkiaViewApi?: NativePagerSkiaViewApi;
  }
).SkiaViewApi;

function pagerApi(): NativePagerSkiaViewApi | undefined {
  return (
    globalThis as typeof globalThis & {
      SkiaViewApi?: NativePagerSkiaViewApi;
    }
  ).SkiaViewApi;
}

export function nativePagerCompositorAvailable(): boolean {
  const api = pagerApi();
  let protocolVersion = 0;
  try {
    protocolVersion = api?.pagerProtocolVersion?.() ?? 0;
  } catch {
    return false;
  }
  return (
    protocolVersion >= 2 &&
    typeof api?.pagerEnqueue === "function" &&
    typeof api.pagerEnqueuePicture === "function" &&
    typeof api.pagerSetAnchor === "function" &&
    typeof api.pagerStockPicture === "function" &&
    typeof api.pagerSetInputEnabled === "function" &&
    typeof api.pagerConfigureMotion === "function" &&
    typeof api.pagerConsumeInput === "function" &&
    typeof api.pagerBeginGesture === "function" &&
    typeof api.pagerUpdateGesture === "function" &&
    typeof api.pagerEndGesture === "function" &&
    typeof api.pagerCancelGesture === "function" &&
    typeof api.pagerRunBenchmark === "function" &&
    typeof api.pagerTakeEvents === "function" &&
    typeof api.pagerReset === "function"
  );
}

export function enqueueNativePagerPictureTurn(
  canvas: NativePagerCanvasHandle | null,
  command: NativePagerPictureTurnCommand,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerEnqueuePicture !== "function") {
    return false;
  }
  try {
    api.pagerEnqueuePicture(
      canvas.getNativeId(),
      command.id,
      command.frontPicture,
      command.backPicture ?? null,
      command.backgroundLeftPicture ?? null,
      command.backgroundRightPicture ?? null,
      command.pixelWidth,
      command.pixelHeight,
      command.direction,
      command.spread,
      command.startAtMs,
      command.durationMs,
      command.launchIntervalMs,
      command.paperColor,
    );
    return true;
  } catch {
    return false;
  }
}

export function enqueueNativePagerTurn(
  canvas: NativePagerCanvasHandle | null,
  command: NativePagerTurnCommand,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerEnqueue !== "function") {
    return false;
  }
  try {
    api.pagerEnqueue(
      canvas.getNativeId(),
      command.id,
      command.frontImage,
      command.backImage ?? null,
      command.direction,
      command.spread,
      command.startAtMs,
      command.durationMs,
      command.launchIntervalMs,
      command.paperColor,
    );
    return true;
  } catch {
    return false;
  }
}

export function preloadNativePagerImage(
  canvas: NativePagerCanvasHandle | null,
  image: SkImage,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerPreload !== "function") {
    return false;
  }
  try {
    api.pagerPreload(canvas.getNativeId(), image);
    return true;
  } catch {
    return false;
  }
}

export function setNativePagerAnchor(
  canvas: NativePagerCanvasHandle | null,
  pageKey: string,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerSetAnchor !== "function") {
    return false;
  }
  try {
    api.pagerSetAnchor(canvas.getNativeId(), pageKey);
    return true;
  } catch {
    return false;
  }
}

export function stockNativePagerPicture(
  canvas: NativePagerCanvasHandle | null,
  command: NativePagerStockPictureCommand,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerStockPicture !== "function") {
    return false;
  }
  try {
    api.pagerStockPicture(
      canvas.getNativeId(),
      command.id,
      command.fromPageKey,
      command.toPageKey,
      command.frontPageKey,
      command.backPageKey ?? null,
      command.backgroundLeftPageKey ?? null,
      command.backgroundRightPageKey ?? null,
      command.frontPicture,
      command.backPicture ?? null,
      command.backgroundLeftPicture ?? null,
      command.backgroundRightPicture ?? null,
      command.pixelWidth,
      command.pixelHeight,
      command.direction,
      command.spread,
      command.contentRevision,
      command.durationMs,
      command.launchIntervalMs,
      command.paperColor,
    );
    return true;
  } catch {
    return false;
  }
}

export function configureNativePagerInput(
  canvas: NativePagerCanvasHandle | null,
  enabled: boolean,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerSetInputEnabled !== "function") {
    return false;
  }
  try {
    api.pagerSetInputEnabled(canvas.getNativeId(), enabled);
    return true;
  } catch {
    return false;
  }
}

export function configureNativePagerMotion(
  canvas: NativePagerCanvasHandle | null,
  config: NativePagerMotionConfig,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerConfigureMotion !== "function") {
    return false;
  }
  try {
    api.pagerConfigureMotion(
      canvas.getNativeId(),
      config.automatic.releaseX,
      config.automatic.liftVelocity,
      config.automatic.liftToLeft,
      config.automatic.curvatureRelaxation,
      config.gesture.releaseX,
      config.gesture.liftVelocity,
      config.gesture.liftToLeft,
      config.gesture.curvatureRelaxation,
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeNativePagerInputOnUI(
  nativeId: number,
  direction: 1 | -1,
): boolean | undefined {
  "worklet";
  try {
    return nativePagerWorkletApi?.pagerConsumeInput?.(nativeId, direction);
  } catch {
    return undefined;
  }
}

export function beginNativePagerGestureOnUI(
  nativeId: number,
  start: NativePagerGestureStart,
): boolean | undefined {
  "worklet";
  try {
    return nativePagerWorkletApi?.pagerBeginGesture?.(
      nativeId,
      start.direction,
      start.startBookX,
      start.fingerX,
      start.turnProgress,
    );
  } catch {
    return undefined;
  }
}

export function updateNativePagerGestureOnUI(
  nativeId: number,
  update: NativePagerGestureUpdate,
): boolean | undefined {
  "worklet";
  try {
    return nativePagerWorkletApi?.pagerUpdateGesture?.(
      nativeId,
      update.fingerX,
      update.turnProgress,
    );
  } catch {
    return undefined;
  }
}

export function endNativePagerGestureOnUI(
  nativeId: number,
  release: NativePagerGestureRelease,
): boolean | undefined {
  "worklet";
  try {
    return nativePagerWorkletApi?.pagerEndGesture?.(
      nativeId,
      release.fingerX,
      release.throwVelocity,
      release.throwAcceleration,
      release.pageWeight,
      release.commitThreshold,
      release.slowCommitEdgeX,
      release.minimumSpeedScale,
      release.maximumSpeedScale,
      release.velocityGain,
    );
  } catch {
    return undefined;
  }
}

export function cancelNativePagerGestureOnUI(
  nativeId: number,
): boolean | undefined {
  "worklet";
  try {
    return nativePagerWorkletApi?.pagerCancelGesture?.(nativeId);
  } catch {
    return undefined;
  }
}

export function runNativePagerBenchmark(
  canvas: NativePagerCanvasHandle | null,
  count: number,
  intervalMs: number,
  direction: 1 | -1,
): boolean {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerRunBenchmark !== "function") {
    return false;
  }
  try {
    api.pagerRunBenchmark(canvas.getNativeId(), count, intervalMs, direction);
    return true;
  } catch {
    return false;
  }
}

export function takeNativePagerEvents(
  canvas: NativePagerCanvasHandle | null,
): readonly NativePagerEventRecord[] {
  const api = pagerApi();
  if (!canvas || typeof api?.pagerTakeEvents !== "function") {
    return [];
  }
  try {
    return api.pagerTakeEvents(canvas.getNativeId());
  } catch {
    return [];
  }
}

export function resetNativePagerCompositor(
  canvas: NativePagerCanvasHandle | null,
): void {
  const api = pagerApi();
  if (canvas && typeof api?.pagerReset === "function") {
    try {
      api.pagerReset(canvas.getNativeId());
    } catch {
      // The Fabric view may already be unregistered during teardown.
    }
  }
}
