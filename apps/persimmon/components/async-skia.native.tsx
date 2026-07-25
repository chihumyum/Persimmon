import type { PropsWithChildren } from "react";

// Skia is embedded in the native binary on native platforms.
export function AsyncSkia({ children }: PropsWithChildren) {
  return children;
}
