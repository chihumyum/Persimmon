import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

const typedSourceFiles = ["**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/coverage/**",
      "apps/persimmon/android/**",
      "apps/persimmon/ios/**",
      "epubs-for-test/**",
      "vendor/react-native-natural-page-turn/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: typedSourceFiles,
    plugins: {
      "import-x": importPlugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "import-x/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["packages/book-core/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "expo",
                "expo/*",
                "react",
                "react-native",
                "react-native/*",
                "@shopify/react-native-skia",
              ],
              message: "book-core must stay platform and renderer independent.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/layout/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "expo",
                "expo/*",
                "react-native",
                "react-native/*",
                "@shopify/react-native-skia",
              ],
              message: "layout must stay platform and renderer independent.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/reader-skia/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@react-native-async-storage/async-storage",
                "expo-file-system",
                "idb",
                "@persimmon/app",
                "@persimmon/app/*",
              ],
              message: "reader-skia must not depend on app storage.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "apps/persimmon/src/components/**/*.{ts,tsx}",
      "apps/persimmon/src/screens/**/*.{ts,tsx}",
      "apps/persimmon/src/reader/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@react-native-async-storage/async-storage",
                "expo-file-system",
                "idb",
              ],
              message:
                "UI code must use a repository or service instead of storage APIs.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
