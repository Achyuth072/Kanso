import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { recommended as tailwindRecommended } from "@poupe/eslint-plugin-tailwindcss";
import reactCompiler from "eslint-plugin-react-compiler";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  tailwindRecommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Ignore generated service worker
    "public/sw.js",
    // Ignore CJS scripts (require() is expected in CommonJS)
    "scripts/generate-changelog.cjs",
  ]),
  // Custom rule overrides
  {
    rules: {
      // Allow underscore-prefixed unused variables (common pattern for intentionally unused params)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "react-compiler/react-compiler": "error",
    },
    plugins: {
      "react-compiler": reactCompiler,
    },
  },
]);

export default eslintConfig;
