import type { Express } from "express";
import request from "supertest";
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
    fullName: overrides.fullName ?? "Test User",
    companyName: overrides.companyName ?? `Company ${Date.now()}`,
  };

  const response = await request(app).post("/api/v1/auth/register").send(payload);

  return {
    app,
    payload,
    response,
    accessToken: response.body.data?.accessToken as string | undefined,
    companyId: response.body.data?.company?.id as string | undefined,
  };
}
