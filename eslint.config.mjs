import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The three architecture conventions from HANDOFF §5, made mechanical:
 *
 *   1. Prisma is reached only from src/modules and src/lib. Pages, actions,
 *      routes and components go through a module's queries.ts / mutations.ts.
 *   2. Money arithmetic happens only in src/lib/money.ts. The UI may format
 *      cents; it may not convert gross to net or back.
 *   3. Modules and lib never import UI (components, app). Dependencies point
 *      one way: app → modules → lib.
 *
 * `no-restricted-imports` is built into ESLint, so this adds no dependency.
 */

const NO_DB_FROM_UI = {
  paths: [
    { name: "@/lib/db", message: "Read through a module's queries.ts or write through its mutations.ts (HANDOFF §5, rule 1)." },
    { name: "@/lib/tx", message: "Transactions are a module concern (HANDOFF §5, rule 1)." },
    { name: "@/generated/prisma/client", message: "Prisma is reached only from src/modules and src/lib (HANDOFF §5, rule 1)." },
    {
      name: "@/lib/money",
      importNames: ["netFromGross", "grossFromNet", "netFromGrossOrNull"],
      message: "Money conversion happens in modules; pages receive DTOs that already carry the right figure (HANDOFF §5, rule 2).",
    },
  ],
};

const NO_UI_FROM_CORE = {
  patterns: [
    { group: ["@/app/*", "@/components/*"], message: "Modules and lib must not depend on UI (HANDOFF §5, rule 3)." },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**", "src/components/**"],
    rules: { "no-restricted-imports": ["error", NO_DB_FROM_UI] },
  },
  {
    files: ["src/modules/**", "src/lib/**"],
    rules: { "no-restricted-imports": ["error", NO_UI_FROM_CORE] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma output.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
