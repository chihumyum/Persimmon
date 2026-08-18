import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@chihumyum/page-turn-core": fileURLToPath(
        new URL(
          "./vendor/react-native-natural-page-turn/packages/page-turn-core/src/index.ts",
          import.meta.url,
        ),
      ),
      "@chihumyum/react-native-natural-page-turn/advanced": fileURLToPath(
        new URL(
          "./vendor/react-native-natural-page-turn/packages/react-native-natural-page-turn/src/advanced.ts",
          import.meta.url,
        ),
      ),
      "@chihumyum/react-native-natural-page-turn": fileURLToPath(
        new URL(
          "./vendor/react-native-natural-page-turn/packages/react-native-natural-page-turn/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    exclude: ["e2e/**", "**/node_modules/**", "**/dist/**", "**/.expo/**"],
    // Exhaustive page-turn curve coverage can exceed Vitest's 5 s default on
    // shared CI runners even though the same deterministic sweep passes.
    testTimeout: 15_000,
  },
});
