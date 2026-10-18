import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests need a database (`npm run test:int`); e2e tests need a
    // running server (`npm run test:e2e`).
    exclude: ["**/node_modules/**", "**/*.int.test.ts", "**/*.e2e.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
