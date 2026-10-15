// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/coverage/**",
      "demo/output/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // A6: no `any` in the core packages.
    files: [
      "packages/shared/**/*.ts",
      "packages/scoring/**/*.ts",
      "packages/parsers/**/*.ts",
      "packages/ats/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
