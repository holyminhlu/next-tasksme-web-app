import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerUser } from "./helpers.js";

describe("authentication", () => {
  it("registers, returns access token and sets refresh cookie", async () => {
    const { response } = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.company.id).toBeTruthy();
    expect(response.headers["set-cookie"]).toBeTruthy();
  });

  it("logs in with valid credentials", async () => {
    const { app, payload } = await registerUser();

    const response = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: payload.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
  });

  it("rejects invalid credentials with the same message", async () => {
    const { app, payload } = await registerUser();

    const response = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: "WrongPassword1",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("refreshes and rotates the refresh token", async () => {
    const { app, response: registerResponse } = await registerUser();
    const cookies = registerResponse.headers["set-cookie"];

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookies);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.accessToken).toBeTruthy();
    expect(refreshResponse.headers["set-cookie"]).toBeTruthy();
  });

  it("returns current user profile for authenticated requests", async () => {
    const { app, accessToken } = await registerUser();

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toContain("@example.com");
    expect(response.body.data.companies.length).toBe(1);
  });

  it("logs out and revokes the refresh session", async () => {
    const { app, response: registerResponse } = await registerUser();
    const cookies = registerResponse.headers["set-cookie"];

    const logoutResponse = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookies);

    expect(logoutResponse.status).toBe(200);

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookies);

    expect(refreshResponse.status).toBe(401);
  });
});
