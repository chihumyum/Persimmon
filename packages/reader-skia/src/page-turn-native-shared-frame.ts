import type { PageTurnWorkletState } from "@persimmon/page-turn-core";
import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";

import {
  createPageTurnNativeFrame,
  resetPageTurnNativeFrameViewportValues,
  updatePageTurnNativeFrameValues,
  type PageTurnNativeFrame,
  type PageTurnPaperRect,
  type PageTurnPaperUniforms,
  type PageTurnShadowUniforms,
} from "./page-turn-native-frame";

export interface PageTurnNativeSharedFrame {
  readonly shadowUniforms: SharedValue<PageTurnShadowUniforms>;
  readonly paperUniforms: SharedValue<PageTurnPaperUniforms>;
  readonly paperRect: SharedValue<PageTurnPaperRect>;
}

export function hidePageTurnNativeSharedFrame(
  frame: PageTurnNativeSharedFrame,
): void {
  "worklet";
  frame.shadowUniforms.modify((shadowUniforms) => {
    shadowUniforms.shadow[2] = 0;
    return shadowUniforms;
  }, true);
  frame.paperRect.modify((paperRect) => {
    paperRect.width = 0;
    return paperRect;
  }, true);
}

export function resetPageTurnNativeSharedFrameViewport(
  frame: PageTurnNativeSharedFrame,
  width: number,
  height: number,
  spread: boolean,
): void {
  "worklet";
  frame.paperUniforms.modify((paperUniforms) => {
    frame.shadowUniforms.modify((shadowUniforms) => {
      frame.paperRect.modify((paperRect) => {
        resetPageTurnNativeFrameViewportValues(
          paperUniforms,
          shadowUniforms,
          paperRect,
          width,
          height,
          spread,
        );
        return paperRect;
      }, true);
      return shadowUniforms;
    }, true);
    return paperUniforms;
  }, true);
}

/**
 * Gives Skia three direct SharedValue inputs. Returning a nested object through
 * useDerivedValue is not sufficient here: the persistent buffers retain their
 * identity, so that intermediary sees the same object and suppresses every
 * update after the first frame.
 */
export function usePageTurnNativeSharedFrame(
  width: number,
  height: number,
  spread: boolean,
): PageTurnNativeSharedFrame {
  const initialFrame = useRef<PageTurnNativeFrame | null>(null);
  initialFrame.current ??= createPageTurnNativeFrame(width, height, spread);
  const shadowUniforms = useSharedValue(initialFrame.current.shadowUniforms);
  const paperUniforms = useSharedValue(initialFrame.current.paperUniforms);
  const paperRect = useSharedValue(initialFrame.current.paperRect);
  const frame = useMemo(
    () => ({ shadowUniforms, paperUniforms, paperRect }),
    [paperRect, paperUniforms, shadowUniforms],
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    scheduleOnUI(
      (nextWidth: number, nextHeight: number, nextSpread: boolean) => {
        "worklet";
        resetPageTurnNativeSharedFrameViewport(
          frame,
          nextWidth,
          nextHeight,
          nextSpread,
        );
      },
      width,
      height,
      spread,
    );
  }, [frame, height, spread, width]);

  return frame;
}

export function updatePageTurnNativeSharedFrame(
  state: PageTurnWorkletState,
  frame: PageTurnNativeSharedFrame,
): void {
  "worklet";
  frame.paperUniforms.modify((paperUniforms) => {
    frame.shadowUniforms.modify((shadowUniforms) => {
      frame.paperRect.modify((paperRect) => {
        updatePageTurnNativeFrameValues(
          state,
          paperUniforms,
          shadowUniforms,
          paperRect,
        );
        return paperRect;
      }, true);
      return shadowUniforms;
    }, true);
    return paperUniforms;
  }, true);
}
