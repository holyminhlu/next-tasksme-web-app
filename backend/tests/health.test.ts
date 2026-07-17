import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "./helpers.js";

describe("health endpoints", () => {
  it("returns liveness without database dependency", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns readiness when database is available", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(200);
    expect(response.body.data.checks.database.status).toBe("up");
  });
});
