import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "./helpers.js";

describe("validation and error envelope", () => {
  it("validates body and returns structured error", async () => {
    const app = buildApp();
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "not-an-email",
      password: "short",
      fullName: "A",
      companyName: "B",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("returns not found envelope for unknown routes", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/v1/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
