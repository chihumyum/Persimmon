export const NATURAL_PAGE_SHADOW_SHADER = `
uniform float2 pageSize;
uniform float4 geometry;
uniform float4 shadow;

half4 main(float2 position) {
  float bookX = (position.x - geometry.x) / geometry.y;
  float distanceFromRoll =
    (bookX - shadow.x) / max(0.035, shadow.y);
  float castShadow =
    exp(-distanceFromRoll * distanceFromRoll * 2.4) * shadow.z;
  float spineShadow =
    exp(-abs(bookX) * 44.0) * min(0.07, shadow.z * 0.32);
  float sourceSide = smoothstep(-0.02, 0.035, bookX * shadow.w);
  return half4(
    0.0,
    0.0,
    0.0,
    clamp((castShadow + spineShadow) * sourceSide, 0.0, 0.42)
  );
}
`;
