import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import { hashToken } from "../src/lib/tokens.js";
import {
  buildApp,
  registerAndLogin,
  registerUser,
  verifyLatestEmail,
} from "./helpers.js";

describe("authentication phase 2", () => {
  it("registers pending user without creating a workspace", async () => {
    const { app, payload, response } = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body.data.requiresEmailVerification).toBe(true);
    expect(response.body.data.accessToken).toBeUndefined();
    expect(response.body.data.workspace).toBeUndefined();
    expect(response.body.data.company).toBeUndefined();

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });
    expect(user?.status).toBe("PENDING_VERIFICATION");
    expect(user?.passwordHash).not.toBe(payload.password);
    expect(user?.passwordHash.startsWith("$argon2")).toBe(true);

    const workspaceCount = await prisma.workspace.count();
    expect(workspaceCount).toBe(0);

    const loginBeforeVerify = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: payload.password,
    });
    expect(loginBeforeVerify.status).toBe(403);
  });

  it("rejects register payloads that still send companyName as unknown extras are ignored but missing fields fail", async () => {
    const app = buildApp();
    const response = await request(app).post("/api/v1/auth/register").send({
      email: `no-name-${Date.now()}@example.com`,
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(response.status).toBe(400);
  });

  it("normalizes email and blocks duplicates", async () => {
    await registerUser({ email: "Owner@Example.com" });
    const duplicate = await registerUser({ email: "owner@example.com" });
    expect(duplicate.response.status).toBe(409);
  });

  it("verifies email then allows login/logout and refresh rotation", async () => {
    const { app, payload } = await registerUser();
    const token = await prisma.oneTimeToken.findFirst({
      where: {
        user: { email: payload.email },
        type: "EMAIL_VERIFICATION",
      },
    });
    expect(token).toBeTruthy();

    const raw = "verify-token-for-test";
    await prisma.oneTimeToken.update({
      where: { id: token!.id },
      data: { tokenHash: hashToken(raw) },
    });

    const verified = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: raw });
    expect(verified.status).toBe(200);

    const login = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: payload.password,
      rememberMe: true,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toBeTruthy();
    expect(login.headers["set-cookie"]).toBeTruthy();

    const cookies = login.headers["set-cookie"];
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", cookies);
    expect(refresh.status).toBe(200);

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", cookies);
    expect(reuse.status).toBe(401);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", refresh.headers["set-cookie"]);
    expect(logout.status).toBe(200);
  });

  it("uses generic invalid credentials and locks after repeated failures", async () => {
    const { app, payload } = await registerUser();
    await verifyLatestEmail(payload.email);

    const first = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: "WrongPassword1",
    });
    expect(first.status).toBe(401);
    expect(first.body.error.message).toBe("Invalid email or password");

    for (let i = 0; i < 4; i += 1) {
      await request(app).post("/api/v1/auth/login").send({
        email: payload.email,
        password: "WrongPassword1",
      });
    }

    const locked = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: payload.password,
    });
    expect(locked.status).toBe(403);
  });

  it("resets password and revokes sessions", async () => {
    const session = await registerAndLogin();
    const raw = "reset-token-for-test";

    await prisma.oneTimeToken.create({
      data: {
        userId: session.userId!,
        type: "PASSWORD_RESET",
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const reset = await request(session.app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: raw,
        password: "NewPassword123",
        confirmPassword: "NewPassword123",
      });
    expect(reset.status).toBe(200);

    const refresh = await request(session.app)
      .post("/api/v1/auth/refresh")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", session.cookies!);
    expect(refresh.status).toBe(401);

    const login = await request(session.app).post("/api/v1/auth/login").send({
      email: session.payload.email,
      password: "NewPassword123",
    });
    expect(login.status).toBe(200);
  });

  it("forgot password does not reveal whether email exists", async () => {
    const app = buildApp();
    const known = await registerUser({ email: `known-${Date.now()}@example.com` });
    const existing = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: known.payload.email });
    const missing = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: `missing-${Date.now()}@example.com` });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body.data.message).toBe(missing.body.data.message);
  });

  it("supports logout-all and session listing", async () => {
    const session = await registerAndLogin();
    const sessions = await request(session.app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.length).toBeGreaterThan(0);

    const logoutAll = await request(session.app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(logoutAll.status).toBe(200);

    const me = await request(session.app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(me.status).toBe(401);
  });
});
