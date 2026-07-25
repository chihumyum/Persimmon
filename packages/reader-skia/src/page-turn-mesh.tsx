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
  PAGE_TURN_SEGMENT_COUNT,
} from "./page-turn-mesh-data";
import { NATIVE_PAGE_PROFILE_RUNS } from "./page-turn-native-frame";
import type { PageTurnNativeSharedFrame } from "./page-turn-native-shared-frame";
import { NATURAL_PAGE_SHADOW_SHADER } from "./page-turn-shader";
import {
  PAGE_TURN_CAMERA_DISTANCE,
  PAGE_TURN_MAX_PERSPECTIVE_SCALE,
  pageTurnCameraBookX,
} from "./page-turn-perspective";
import type { PageTurnFace } from "./page-turn-stack";
import type { PageTurnRenderFrame } from "./page-turn-worklet-frame";

let cachedShadowEffect:
  | NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
  | undefined;
const cachedPaperEffects = new Map<
  string,
  NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
>();
const cachedNativePaperEffects = new Map<
  PageTurnFace | "both",
  NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>
>();

interface PageTurnMeshProps {
  readonly paperImage: SkImage;
  readonly backImage?: SkImage;
  readonly initialProfile?: readonly number[];
  readonly nativeFrame?: PageTurnNativeSharedFrame;
  readonly width: number;
  readonly height: number;
  readonly spread?: boolean;
  readonly face?: PageTurnFace | "both";
  readonly drawShadow?: boolean;
  readonly direction?: 1 | -1;
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
): PageTurnRenderFrame {
  return {
    mapping: buildPageTurnLookup(
      profile,
      pageTurnLookupSampleCount(viewportWidth),
      spread ? -1 : 0,
      1,
      direction,
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
    const key = paperEffectKey(sampleCount, spread, face);
    if (!cachedPaperEffects.has(key)) {
      cachedPaperEffects.set(
        key,
        requireRuntimeEffect(
          pageTurnPaperShader(sampleCount, spread, face),
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
          paperImage={props.paperImage}
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
  readonly nativeFrame: PageTurnNativeSharedFrame;
  readonly width: number;
  readonly height: number;
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
  face = "both",
  drawShadow = true,
}: NativePageTurnMeshProps) {
  const actualBackImage = backImage ?? paperImage;
  const { shadowUniforms, paperUniforms, paperRect } = nativeFrame;
  cachedShadowEffect ??= requireRuntimeEffect(
    NATURAL_PAGE_SHADOW_SHADER,
    "page shadow",
  );
  if (!cachedNativePaperEffects.has(face)) {
    cachedNativePaperEffects.set(
      face,
      requireRuntimeEffect(
        nativePageTextureShader(face),
        `native ${face} pixel paper texture`,
      ),
    );
  }
  const paperEffect = cachedNativePaperEffects.get(face)!;

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
          <ImageShader
            fit="fill"
            image={actualBackImage}
            height={1}
            sampling={{ B: 0, C: 0.5 }}
            tx="clamp"
            ty="clamp"
            width={1}
            x={0}
            y={0}
          />
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
      width,
      height,
      spread = false,
      face = "both",
      drawShadow = true,
      direction = 1,
    },
    ref,
  ) {
    const lookupSamples = pageTurnLookupSampleCount(width);
    const minimumBookX = spread ? -1 : 0;
    const maximumBookX = 1;
    const cameraBookX = pageTurnCameraBookX(minimumBookX, maximumBookX);
    const paperWidth = spread ? width * 0.5 : width;
    const spineX = spread ? paperWidth : 0;
    preparePageTurnRenderer(width, spread);
    const shadowEffect = cachedShadowEffect!;
    const paperEffect = cachedPaperEffects.get(
      paperEffectKey(lookupSamples, spread, face),
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
      );
    }, [direction, initialProfile, lookupSamples, maximumBookX, minimumBookX]);
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

function nativePageTextureShader(face: PageTurnFace | "both"): string {
  const profilePointCount = PAGE_TURN_SEGMENT_COUNT + 1;
  const sampleRuns = new Array(NATIVE_PAGE_PROFILE_RUNS)
    .fill(0)
    .map(
      (_, index) => `  candidate = sampleRun(bookX, runs[${index}]);
  if (candidate.z > visible.z) {
    visible = candidate;
  }`,
    )
    .join("\n");
  return `
uniform shader frontTexture;
uniform shader backTexture;
uniform float2 pageSize;
uniform float4 geometry;
uniform float4 perspective;
uniform float4 profile[${profilePointCount}];
uniform float4 runs[${NATIVE_PAGE_PROFILE_RUNS}];

float4 readProfile(int pointIndex) {
${nativeProfileSelector(0, profilePointCount, "  ")}
}

float perspectiveScale(float depth) {
  return min(
    perspective.z,
    perspective.y / max(0.001, perspective.y - max(0.0, depth))
  );
}

float4 sampleRun(float bookX, float4 run) {
  if (run.w < 0.5) {
    return float4(0.0, 1.0, -100000.0, 0.0);
  }
  int low = int(run.x);
  int high = int(run.y);
  float lowX = readProfile(low).x;
  float highX = readProfile(high).x;
  if (bookX < min(lowX, highX) || bookX > max(lowX, highX)) {
    return float4(0.0, 1.0, -100000.0, 0.0);
  }

  for (int step = 0; step < 6; step += 1) {
    if (high - low > 1) {
      int middle = (low + high) / 2;
      float middleX = readProfile(middle).x;
      bool belongsToLower =
        run.z > 0.0 ? middleX <= bookX : middleX >= bookX;
      if (belongsToLower) {
        low = middle;
      } else {
        high = middle;
      }
    }
  }

  float4 before = readProfile(low);
  float4 after = readProfile(high);
  float deltaX = after.x - before.x;
  if (abs(deltaX) < 0.000001) {
    return float4(0.0, 1.0, -100000.0, 0.0);
  }
  float screenProgress = clamp((bookX - before.x) / deltaX, 0.0, 1.0);
  float beforeScale = perspectiveScale(before.y);
  float afterScale = perspectiveScale(after.y);
  float perspectiveDenominator =
    (1.0 - screenProgress) * beforeScale +
    screenProgress * afterScale;
  float progress = perspectiveDenominator <= 0.000001
    ? screenProgress
    : screenProgress * afterScale / perspectiveDenominator;
  float material =
    (float(low) + progress) / ${PAGE_TURN_SEGMENT_COUNT}.0;
  float depth = mix(before.y, after.y, progress);
  float normalZ = abs(mix(before.w, after.w, progress));
  bool frontFacing = deltaX > 0.0;
  bool sourceFacing =
    (frontFacing ? 1.0 : -1.0) * perspective.w > 0.0;
  float deformation = 1.0 - normalZ;
  float shade =
    deformation * 0.16 +
    (sourceFacing ? 0.0 : deformation * 0.055);
  return float4(material, 1.0 - min(0.2, shade), depth, frontFacing ? 1.0 : -1.0);
}

half4 main(float2 position) {
  float bookX = (position.x - geometry.x) / geometry.y;
  float4 visible = float4(0.0, 1.0, -100000.0, 0.0);
  float4 candidate;
${sampleRuns}
  if (visible.z < -99999.0) {
    return half4(0.0);
  }
${pageTurnFaceGuard("visible.w", face)}

  float sourceMaterial =
    visible.w > 0.0 ? visible.x : 1.0 - visible.x;
  float sourceY =
    0.5 + (position.y / pageSize.y - 0.5) / perspectiveScale(visible.z);
  float2 source = float2(
    clamp(sourceMaterial, 0.0, 1.0),
    clamp(sourceY, 0.0, 1.0)
  );
  half4 paper = visible.w > 0.0
    ? frontTexture.eval(source)
    : backTexture.eval(source);
  return half4(paper.rgb * visible.y, 1.0);
}
`;
}

function nativeProfileSelector(
  start: number,
  end: number,
  indent: string,
): string {
  if (end - start === 1) {
    return `${indent}return profile[${start}];`;
  }
  const middle = Math.floor((start + end) * 0.5);
  const nestedIndent = `${indent}  `;
  return [
    `${indent}if (pointIndex < ${middle}) {`,
    nativeProfileSelector(start, middle, nestedIndent),
    `${indent}} else {`,
    nativeProfileSelector(middle, end, nestedIndent),
    `${indent}}`,
  ].join("\n");
}

function paperEffectKey(
  sampleCount: number,
  twoSided: boolean,
  face: PageTurnFace | "both",
): string {
  return `${sampleCount}:${twoSided ? "two-sided" : "front-only"}:${face}`;
}

function pageTurnPaperShader(
  sampleCount: number,
  twoSided: boolean,
  face: PageTurnFace | "both",
): string {
  return `
uniform shader paperTexture;
${twoSided ? "uniform shader backTexture;" : ""}
uniform float2 pageSize;
uniform float2 imageSize;
${twoSided ? "uniform float2 backImageSize;" : ""}
uniform float4 geometry;
uniform float4 perspective;
uniform float4 mapping[${sampleCount}];

float4 readPageMap(int cell) {
${pageTurnLookupSelector(sampleCount, 0, sampleCount, "  ")}
}

float perspectiveScale(float depth) {
  return min(
    perspective.z,
    perspective.y / max(0.001, perspective.y - max(0.0, depth))
  );
}

half4 main(float2 position) {
  float bookX = (position.x - geometry.x) / geometry.y;
  float lookupX = clamp(
    (bookX - geometry.z) / geometry.w,
    0.0,
    0.999999
  );
  int cell = int(floor(lookupX * ${sampleCount}.0));
  float4 pageMap = readPageMap(cell);
  if (abs(pageMap.w) < 0.5) {
    return half4(0.0);
  }
${pageTurnFaceGuard("pageMap.w", face)}

  float cellCenter =
    geometry.z +
    (float(cell) + 0.5) / ${sampleCount}.0 * geometry.w;
  float material = clamp(
    pageMap.x + pageMap.y * (bookX - cellCenter),
    0.0,
    1.0
  );
  float sourceMaterial = pageMap.w > 0.0 ? material : 1.0 - material;
  float visibleDepth = max(0.0, abs(pageMap.w) - 1.0);
  float sourceY =
    0.5 + (position.y / pageSize.y - 0.5) /
    perspectiveScale(visibleDepth);
  half4 paper;
  if (pageMap.w > 0.0) {
    float sourceX = sourceMaterial * imageSize.x;
    paper = paperTexture.eval(float2(sourceX, sourceY * imageSize.y));
  } else {
    ${
      twoSided
        ? `float sourceX = sourceMaterial * backImageSize.x;
    paper = backTexture.eval(float2(sourceX, sourceY * backImageSize.y));`
        : `float sourceX = sourceMaterial * imageSize.x;
    paper = paperTexture.eval(float2(sourceX, sourceY * imageSize.y));`
    }
  }
  return half4(paper.rgb * pageMap.z, 1.0);
}
`;
}

function pageTurnFaceGuard(
  signedFace: string,
  face: PageTurnFace | "both",
): string {
  if (face === "front") {
    return `  if (${signedFace} <= 0.0) {
    return half4(0.0);
  }`;
  }
  if (face === "back") {
    return `  if (${signedFace} >= 0.0) {
    return half4(0.0);
  }`;
  }
  return "";
}

function pageTurnLookupSelector(
  sampleCount: number,
  start: number,
  end: number,
  indent: string,
): string {
  if (end - start === 1) {
    return `${indent}return mapping[${start}];`;
  }
  const middle = Math.floor((start + end) * 0.5);
  const nestedIndent = `${indent}  `;
  return [
    `${indent}if (cell < ${middle}) {`,
    pageTurnLookupSelector(sampleCount, start, middle, nestedIndent),
    `${indent}} else {`,
    pageTurnLookupSelector(sampleCount, middle, end, nestedIndent),
    `${indent}}`,
  ].join("\n");
}

function requireRuntimeEffect(source: string, label: string) {
  const effect = Skia.RuntimeEffect.Make(source);
  if (!effect) {
    throw new Error(`Unable to compile the natural ${label} shader.`);
  }
  return effect;
}
