import { describe, expect, it } from "vitest";
import { loadEnv, resetEnvCache } from "../src/config/env.js";

describe("env validation", () => {
  it("fails when required secrets are missing", () => {
    resetEnvCache();

    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/taskmng_test",
        JWT_ACCESS_SECRET: "short",
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("loads a valid configuration", () => {
    resetEnvCache();

    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:pass@localhost:5432/taskmng_test",
      JWT_ACCESS_SECRET: "test-only-change-me-taskmng-access-secret-32",
      CORS_ORIGINS: "http://localhost:3000,http://localhost:3001",
    });

    expect(env.CORS_ORIGINS).toEqual(["http://localhost:3000", "http://localhost:3001"]);
    expect(env.isTest).toBe(true);
  });
});
