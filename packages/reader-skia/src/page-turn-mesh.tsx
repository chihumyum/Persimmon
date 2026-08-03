import {
  ImageShader,
  Rect,
  Shader,
  type SkImage,
  Skia,
} from "@shopify/react-native-skia";
import { forwardRef, useImperativeHandle, useMemo } from "react";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

import {
  buildPageTurnLookup,
  pageTurnLookupSampleCount,
} from "./page-turn-mesh-data";
import type { PageTurnNativeSharedFrame } from "./page-turn-native-shared-frame";
import { NATURAL_PAGE_SHADOW_SHADER } from "./page-turn-shader";
import {
  PAGE_TURN_CAMERA_DISTANCE,
  PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  pageTurnCameraBookX,
} from "./page-turn-perspective";
import type { PageTurnFace } from "./page-turn-stack";
import {
  nativePageTextureShader,
  nativePaperEffectKey,
  pageTurnPaperEffectKey,
  pageTurnPaperShader,
} from "./page-turn-texture-shader";
import type { PageTurnRenderFrame } from "./page-turn-worklet-frame";
import { DEFAULT_READER_THEME } from "./reader-theme";

let cachedShadowEffect:
  | NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
  | undefined;
const cachedPaperEffects = new Map<
  string,
  NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
>();
const cachedNativePaperEffects = new Map<
  string,
  NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
>();

interface PageTurnMeshProps {
  readonly paperImage: SkImage;
  readonly backImage?: SkImage;
  readonly paperColor?: string;
  readonly initialProfile?: readonly number[];
  readonly nativeFrame?: PageTurnNativeSharedFrame;
  readonly width: number;
  readonly height: number;
  readonly spread?: boolean;
  readonly face?: PageTurnFace | "both";
  readonly drawShadow?: boolean;
  readonly direction?: 1 | -1;
  readonly incomingPageProgress?: number;
}

export interface PageTurnMeshHandle {
  updateFrame(frame: PageTurnRenderFrame): void;
}

export function buildWebPageTurnRenderFrame(
  profile: readonly number[],
  shadow: readonly number[],
  viewportWidth: number,
  spread: boolean,
  direction: 1 | -1 = 1,
  incomingPageProgress?: number,
): PageTurnRenderFrame {
  return {
    mapping: buildPageTurnLookup(
      profile,
      pageTurnLookupSampleCount(viewportWidth),
      spread ? -1 : 0,
      1,
      direction,
      incomingPageProgress,
    ),
    shadow: [...shadow],
  };
}

/**
 * Compiles the generated effects once. The reader calls this after its first
 * paint so shader compilation never lands on the first page-turn frame.
 */
export function preparePageTurnRenderer(
  viewportWidth: number,
  spread = false,
  paperColor = DEFAULT_READER_THEME.paper,
): void {
  cachedShadowEffect ??= requireRuntimeEffect(
    NATURAL_PAGE_SHADOW_SHADER,
    "page shadow",
  );
  const sampleCount = pageTurnLookupSampleCount(viewportWidth);
  const faces: readonly (PageTurnFace | "both")[] = spread
    ? ["both", "back", "front"]
    : ["both"];
  for (const face of faces) {
    const key = pageTurnPaperEffectKey(sampleCount, spread, face, paperColor);
    if (!cachedPaperEffects.has(key)) {
      cachedPaperEffects.set(
        key,
        requireRuntimeEffect(
          pageTurnPaperShader(sampleCount, spread, face, paperColor),
          spread ? `${face} paper texture` : "paper texture",
        ),
      );
    }
  }
}

export const PageTurnMesh = forwardRef<PageTurnMeshHandle, PageTurnMeshProps>(
  function PageTurnMesh(props, ref) {
    if (props.nativeFrame) {
      return (
        <NativePageTurnMesh
          backImage={props.backImage}
          height={props.height}
          face={props.face}
          drawShadow={props.drawShadow}
          nativeFrame={props.nativeFrame}
          paperColor={props.paperColor}
          paperImage={props.paperImage}
          spread={props.spread}
          width={props.width}
        />
      );
    }
    return <LookupPageTurnMesh {...props} ref={ref} />;
  },
);

interface NativePageTurnMeshProps {
  readonly paperImage: SkImage;
  readonly backImage?: SkImage;
  readonly paperColor?: string;
  readonly nativeFrame: PageTurnNativeSharedFrame;
  readonly width: number;
  readonly height: number;
  readonly spread?: boolean;
  readonly face?: PageTurnFace | "both";
  readonly drawShadow?: boolean;
}

/**
 * Native Skia inverts the 65-point curve per fragment across its monotonic
 * runs. This retains physical-pixel edges without a screen-x lookup grid while
 * uploading only the compact physical profile.
 */
function NativePageTurnMesh({
  paperImage,
  backImage,
  nativeFrame,
  width,
  height,
  paperColor = DEFAULT_READER_THEME.paper,
  spread = false,
  face = "both",
  drawShadow = true,
}: NativePageTurnMeshProps) {
  const { shadowUniforms, paperUniforms, paperRect } = nativeFrame;
  cachedShadowEffect ??= requireRuntimeEffect(
    NATURAL_PAGE_SHADOW_SHADER,
    "page shadow",
  );
  const effectKey = nativePaperEffectKey(face, spread, paperColor);
  if (!cachedNativePaperEffects.has(effectKey)) {
    cachedNativePaperEffects.set(
      effectKey,
      requireRuntimeEffect(
        nativePageTextureShader(face, spread, paperColor),
        `native ${face} pixel paper texture`,
      ),
    );
  }
  const paperEffect = cachedNativePaperEffects.get(effectKey)!;

  return (
    <>
      {drawShadow ? (
        <Rect x={0} y={0} width={width} height={height}>
          <Shader source={cachedShadowEffect} uniforms={shadowUniforms} />
        </Rect>
      ) : null}
      <Rect rect={paperRect}>
        <Shader source={paperEffect} uniforms={paperUniforms}>
          <ImageShader
            fit="fill"
            image={paperImage}
            height={1}
            sampling={{ B: 0, C: 0.5 }}
            tx="clamp"
            ty="clamp"
            width={1}
            x={0}
            y={0}
          />
          {spread ? (
            <ImageShader
              fit="fill"
              image={backImage ?? paperImage}
              height={1}
              sampling={{ B: 0, C: 0.5 }}
              tx="clamp"
              ty="clamp"
              width={1}
              x={0}
              y={0}
            />
          ) : null}
        </Shader>
      </Rect>
    </>
  );
}

const LookupPageTurnMesh = forwardRef<PageTurnMeshHandle, PageTurnMeshProps>(
  function LookupPageTurnMesh(
    {
      paperImage,
      backImage,
      initialProfile,
      paperColor = DEFAULT_READER_THEME.paper,
      width,
      height,
      spread = false,
      face = "both",
      drawShadow = true,
      direction = 1,
      incomingPageProgress,
    },
    ref,
  ) {
    const lookupSamples = pageTurnLookupSampleCount(width);
    const minimumBookX = spread ? -1 : 0;
    const maximumBookX = 1;
    const cameraBookX = pageTurnCameraBookX(minimumBookX, maximumBookX);
    const paperWidth = spread ? width * 0.5 : width;
    const spineX = spread ? paperWidth : 0;
    preparePageTurnRenderer(width, spread, paperColor);
    const shadowEffect = cachedShadowEffect!;
    const paperEffect = cachedPaperEffects.get(
      pageTurnPaperEffectKey(lookupSamples, spread, face, paperColor),
    )!;
    const initialLookup = useMemo(() => {
      if (!initialProfile) {
        throw new Error("A web page turn requires an initial profile.");
      }
      return buildPageTurnLookup(
        initialProfile,
        lookupSamples,
        minimumBookX,
        maximumBookX,
        direction,
        incomingPageProgress,
      );
    }, [
      direction,
      incomingPageProgress,
      initialProfile,
      lookupSamples,
      maximumBookX,
      minimumBookX,
    ]);
    const fallbackFrame = useSharedValue<PageTurnRenderFrame>({
      mapping: initialLookup,
      shadow: [0.5, 0.045, 0, 1],
    });
    const shadowUniforms = useDerivedValue(() => ({
      geometry: [spineX, paperWidth, minimumBookX, maximumBookX - minimumBookX],
      pageSize: [width, height],
      shadow: fallbackFrame.value.shadow,
    }));
    const paperUniforms = useDerivedValue(() => ({
      geometry: [spineX, paperWidth, minimumBookX, maximumBookX - minimumBookX],
      pageSize: [width, height],
      imageSize: [paperImage.width(), paperImage.height()],
      backImageSize: [
        (backImage ?? paperImage).width(),
        (backImage ?? paperImage).height(),
      ],
      perspective: [
        cameraBookX,
        PAGE_TURN_CAMERA_DISTANCE,
        PAGE_TURN_MAX_PERSPECTIVE_SCALE,
        0,
      ],
      mapping: fallbackFrame.value.mapping,
    }));

    useImperativeHandle(
      ref,
      () => ({
        updateFrame(frame) {
          fallbackFrame.value = frame;
        },
      }),
      [fallbackFrame],
    );

    return (
      <>
        {drawShadow ? (
          <Rect x={0} y={0} width={width} height={height}>
            <Shader source={shadowEffect} uniforms={shadowUniforms} />
          </Rect>
        ) : null}
        <Rect x={0} y={0} width={width} height={height}>
          <Shader source={paperEffect} uniforms={paperUniforms}>
            <ImageShader
              fit="none"
              image={paperImage}
              sampling={{ B: 0, C: 0.5 }}
              tx="clamp"
              ty="clamp"
            />
            {spread ? (
              <ImageShader
                fit="none"
                image={backImage ?? paperImage}
                sampling={{ B: 0, C: 0.5 }}
                tx="clamp"
                ty="clamp"
              />
            ) : null}
          </Shader>
        </Rect>
      </>
    );
  },
);

function requireRuntimeEffect(source: string, label: string) {
  const effect = Skia.RuntimeEffect.Make(source);
  if (!effect) {
    throw new Error(`Unable to compile the natural ${label} shader.`);
  }
  return effect;
}
