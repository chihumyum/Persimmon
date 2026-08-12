import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@chihumyum/page-turn-core": fileURLToPath(
        new URL(
          "./vendor/react-native-skia-page-turn/packages/page-turn-core/src/index.ts",
          import.meta.url,
        ),
      ),
      "@chihumyum/react-native-skia-page-turn/advanced": fileURLToPath(
        new URL(
          "./vendor/react-native-skia-page-turn/packages/react-native-skia-page-turn/src/advanced.ts",
          import.meta.url,
        ),
      ),
      "@chihumyum/react-native-skia-page-turn": fileURLToPath(
        new URL(
          "./vendor/react-native-skia-page-turn/packages/react-native-skia-page-turn/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    exclude: ["e2e/**", "**/node_modules/**", "**/dist/**", "**/.expo/**"],
  },
});
