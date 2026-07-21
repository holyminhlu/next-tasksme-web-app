import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const managedServers = process.env.PW_START_SERVERS === "1";
const frontendUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:4001";

function readEnvFile(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return [line, ""];
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [line.slice(0, separator).trim(), value];
      }),
  );
}

function managedWebServers(): PlaywrightTestConfig["webServer"] {
  if (!managedServers) return undefined;

  const testEnv = readEnvFile(resolve("backend/.env.test"));
  const databaseUrl = process.env.E2E_DATABASE_URL ?? testEnv.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Managed E2E requires DATABASE_URL in backend/.env.test or E2E_DATABASE_URL.",
    );
  }

  const databaseName = new URL(databaseUrl).pathname.replace(/^\/+/, "");
  if (databaseName !== "taskmng_test" && !databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing managed E2E against database "${databaseName}". Use taskmng_test or another *_test database.`,
    );
  }

  const backendEnv = {
    ...process.env,
    ...testEnv,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    PORT: "4001",
    APP_URL: apiUrl,
    FRONTEND_URL: frontendUrl,
    CORS_ORIGINS: frontendUrl,
    REQUIRE_EMAIL_VERIFICATION: "false",
    LOG_LEVEL: "silent",
    WORKER_ENABLED: "false",
  };

  return [
    {
      command: "npm run prisma:deploy --prefix backend && npm run dev --prefix backend",
      url: `${apiUrl}/api/v1/health/ready`,
      env: backendEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev --prefix frontend -- --hostname 127.0.0.1 --port 3001",
      url: frontendUrl,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: apiUrl,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ];
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results/playwright",
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: managedWebServers(),
});
