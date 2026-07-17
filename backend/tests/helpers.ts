import type { Express } from "express";
import request from "supertest";
import { prisma } from "../src/config/database.js";
import { createApp } from "../src/app.js";

type RegisterOverrides = Partial<{
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}>;

export function buildApp() {
  return createApp();
}

export async function registerUser(
  overrides: RegisterOverrides = {},
  app: Express = buildApp(),
) {
  const payload = {
    email: overrides.email ?? `user-${Date.now()}@example.com`,
    password: overrides.password ?? "Password123",
    confirmPassword: overrides.password ?? "Password123",
    fullName: overrides.fullName ?? "Test User",
    companyName: overrides.companyName ?? `Company ${Date.now()}`,
  };

  const response = await request(app).post("/api/v1/auth/register").send(payload);

  return {
    app,
    payload,
    response,
    companyId: response.body.data?.company?.id as string | undefined,
    userId: response.body.data?.user?.id as string | undefined,
  };
}

export async function verifyLatestEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("User not found");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.oneTimeToken.updateMany({
    where: {
      userId: user.id,
      type: "EMAIL_VERIFICATION",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  return user;
}

export async function registerAndLogin(
  overrides: RegisterOverrides = {},
  app: Express = buildApp(),
) {
  const registered = await registerUser(overrides, app);
  await verifyLatestEmail(registered.payload.email);

  const loginResponse = await request(app).post("/api/v1/auth/login").send({
    email: registered.payload.email,
    password: registered.payload.password,
    rememberMe: false,
  });

  return {
    ...registered,
    loginResponse,
    accessToken: loginResponse.body.data?.accessToken as string | undefined,
    cookies: loginResponse.headers["set-cookie"] as unknown as
      | string[]
      | undefined,
  };
}
