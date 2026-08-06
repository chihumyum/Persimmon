import {
  ImageShader,
  Rect,
  Shader,
  type SkImage,
  Skia,
} from "@shopify/react-native-skia";

import type { PageTurnNativeSharedFrame } from "./page-turn-native-shared-frame";
import { NATURAL_PAGE_SHADOW_SHADER } from "./page-turn-shader";
import type { PageTurnFace } from "./page-turn-stack";
import {
  nativePageTextureShader,
  nativePaperEffectKey,
} from "./page-turn-texture-shader";
import { DEFAULT_READER_THEME } from "./reader-theme";

let cachedShadowEffect:
  | NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
  | undefined;
const cachedNativePaperEffects = new Map<
  string,
  NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
>();

interface PageTurnMeshProps {
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
export function PageTurnMesh({
  paperImage,
  backImage,
  nativeFrame,
  width,
  height,
  paperColor = DEFAULT_READER_THEME.paper,
  spread = false,
  face = "both",
  drawShadow = true,
}: PageTurnMeshProps) {
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

function requireRuntimeEffect(source: string, label: string) {
  const effect = Skia.RuntimeEffect.Make(source);
  if (!effect) {
    throw new Error(`Unable to compile the natural ${label} shader.`);
  }
  return effect;
}
