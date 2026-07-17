import type { Express } from "express";
import request from "supertest";
import { prisma } from "../src/config/database.js";
import { createApp } from "../src/app.js";

type RegisterOverrides = Partial<{
  email: string;
  password: string;
  fullName: string;
}>;

type WorkspaceOverrides = Partial<{
  type: "PERSONAL" | "ORGANIZATION";
  name: string;
  usagePurpose: string;
  industryCode: string;
  companySize: string;
  timezone: string;
  locale: string;
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
  };

  const response = await request(app).post("/api/v1/auth/register").send(payload);

  return {
    app,
    payload,
    response,
    userId: response.body.data?.user?.id as string | undefined,
  };
}

export async function verifyLatestEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === "ACTIVE" && user.emailVerifiedAt) {
    return user;
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

export async function createWorkspace(
  accessToken: string,
  overrides: WorkspaceOverrides = {},
  app: Express = buildApp(),
) {
  const payload = {
    type: overrides.type ?? "ORGANIZATION",
    name: overrides.name ?? `Workspace ${Date.now()}`,
    usagePurpose: overrides.usagePurpose,
    industryCode: overrides.industryCode,
    companySize: overrides.companySize,
    timezone: overrides.timezone,
    locale: overrides.locale,
  };

  const response = await request(app)
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(payload);

  return {
    response,
    workspaceId: response.body.data?.id as string | undefined,
    payload,
  };
}

export async function registerLoginAndCreateWorkspace(
  overrides: RegisterOverrides & WorkspaceOverrides = {},
  app: Express = buildApp(),
) {
  const session = await registerAndLogin(overrides, app);
  const workspace = await createWorkspace(
    session.accessToken!,
    {
      type: overrides.type,
      name: overrides.name,
      usagePurpose: overrides.usagePurpose,
      industryCode: overrides.industryCode,
      companySize: overrides.companySize,
      timezone: overrides.timezone,
      locale: overrides.locale,
    },
    session.app,
  );

  return {
    ...session,
    ...workspace,
  };
}
