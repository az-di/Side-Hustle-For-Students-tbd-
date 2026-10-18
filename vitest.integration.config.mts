import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration tests run against the real Postgres in DATABASE_URL (your local
 * one, or a throwaway). They create their own rows under random @uw.edu
 * addresses and delete them afterwards, so they are safe to run against a
 * seeded dev database. `npm run test:int`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    setupFiles: ["./src/test/integration-setup.ts"],
    // One file at a time: they share a database.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
