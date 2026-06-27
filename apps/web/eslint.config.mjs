import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Package layering (domain → integrations/prompts, no upward/cross) is already
      // enforced by pnpm: a package can't import what its package.json doesn't declare.
      // ESLint covers the gap pnpm can't — one app reaching into another.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@singularity/worker", "@singularity/worker/*", "**/apps/worker/*"],
              message: "apps must not import other apps; share code via packages/*.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
