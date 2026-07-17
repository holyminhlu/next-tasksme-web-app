import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

loadDotenv({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
    },
  },
});
