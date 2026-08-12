import { DEFAULT_PAGE_PROFILE_POINTS } from "@chihumyum/page-turn-core";
import { NATIVE_PAGE_PROFILE_RUNS } from "./page-turn-native-frame";
import type { PageTurnFace } from "./page-turn-stack";
import { DEFAULT_READER_THEME } from "./reader-theme";

const PAGE_TURN_SEGMENT_COUNT = DEFAULT_PAGE_PROFILE_POINTS - 1;

function shaderPaperRgb(hexColor: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hexColor);
  if (!match) {
    throw new TypeError(`paper color must be #RRGGBB, received ${hexColor}`);
  }
  const hex = match[1]!;
  const channel = (index: number): string =>
    (Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16) / 255).toFixed(6);
  return `half3(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function nativePaperEffectKey(
  face: PageTurnFace | "both",
  twoSided: boolean,
  paperColor = DEFAULT_READER_THEME.paper,
): string {
  return `v3:${twoSided ? "two-sided" : `one-sided:${paperColor.toLowerCase()}`}:${face}`;
}

export function nativePageTextureShader(
  face: PageTurnFace | "both",
  twoSided: boolean,
  paperColor = DEFAULT_READER_THEME.paper,
): string {
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
${twoSided ? "uniform shader backTexture;" : ""}
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
${
  twoSided
    ? `
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
  return half4(paper.rgb * visible.y, 1.0);`
    : `
  // A single-page turn captures only its printed face. Keep the underside as
  // shaded blank stock instead of mirroring that page's text onto its back.
  if (visible.w < 0.0) {
    return half4(${shaderPaperRgb(paperColor)} * visible.y, 1.0);
  }
  float sourceY =
    0.5 + (position.y / pageSize.y - 0.5) / perspectiveScale(visible.z);
  float2 source = float2(
    clamp(visible.x, 0.0, 1.0),
    clamp(sourceY, 0.0, 1.0)
  );
  half4 paper = frontTexture.eval(source);
  return half4(paper.rgb * visible.y, 1.0);`
}
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
