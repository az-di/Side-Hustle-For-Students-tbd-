import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * End-to-end tests over HTTP against a RUNNING server (E2E_BASE_URL, default
 * http://localhost:3000) that shares this process's DATABASE_URL. The pages
 * are server-rendered, so fetching them with a session cookie is enough to
 * assert on what a person would see — no browser needed. `npm run test:e2e`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/e2e/**/*.e2e.test.ts"],
    setupFiles: ["./src/test/integration-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
