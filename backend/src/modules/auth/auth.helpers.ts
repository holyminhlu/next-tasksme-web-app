import type { CookieOptions, Request } from "express";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { getEnv } from "../../config/env.js";
import {
  createTokenFamilyId,
  generateOpaqueToken,
  hashToken,
  signAccessToken,
} from "../../lib/tokens.js";
import {
  PERMISSIONS,
  ROLE_PERMISSION_MAP,
  SYSTEM_ROLE_KEYS,
} from "./permissions.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function ensureUniqueSlug(
  base: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  let candidate = base || "company";
  let suffix = 1;

  while (true) {
    const existing = await tx.company.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function ensurePermissionCatalog(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  for (const permission of PERMISSIONS) {
    await tx.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: {
        key: permission.key,
        description: permission.description,
      },
    });
  }
}

export async function createCompanyRoles(
  companyId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const permissions = await tx.permission.findMany();
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.key, permission.id]),
  );

  const roles = [];

  for (const roleKey of SYSTEM_ROLE_KEYS) {
    const role = await tx.role.create({
      data: {
        companyId,
        key: roleKey,
        name: roleKey.charAt(0).toUpperCase() + roleKey.slice(1),
        description: `${roleKey} role`,
        isSystem: true,
        rolePermissions: {
          create: ROLE_PERMISSION_MAP[roleKey]
            .map((permissionKey) => {
              const permissionId = permissionByKey.get(permissionKey);
              return permissionId ? { permissionId } : null;
            })
            .filter((item): item is { permissionId: string } => Boolean(item)),
        },
      },
    });

    roles.push(role);
  }

  return roles;
}

export function addDays(days: number, from = new Date()): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
}

export function addHours(hours: number, from = new Date()): Date {
  const date = new Date(from);
  date.setHours(date.getHours() + hours);
  return date;
}

export function getRefreshCookieOptions(rememberMe: boolean): CookieOptions {
  const env = getEnv();
  const maxAgeDays = rememberMe
    ? env.REFRESH_TOKEN_REMEMBER_DAYS
    : env.REFRESH_TOKEN_EXPIRES_DAYS;

  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: "/api/v1/auth",
    maxAge: rememberMe ? maxAgeDays * 24 * 60 * 60 * 1000 : undefined,
  };
}

export function getClientMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
    requestId: req.requestId,
  };
}

export async function issueTokenPair(
  user: { id: string; email: string; authVersion: number },
  req: Request,
  options: { rememberMe?: boolean; familyId?: string } = {},
) {
  const env = getEnv();
  const rememberMe = options.rememberMe ?? false;
  const familyId = options.familyId ?? createTokenFamilyId();
  const refreshToken = generateOpaqueToken();
  const tokenHash = hashToken(refreshToken);
  const rollingDays = rememberMe
    ? env.REFRESH_TOKEN_REMEMBER_DAYS
    : env.REFRESH_TOKEN_EXPIRES_DAYS;
  const absoluteDays = Math.max(rollingDays, env.REFRESH_TOKEN_ABSOLUTE_DAYS);

  const session = await prisma.refreshSession.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash,
      rememberMe,
      expiresAt: addDays(rollingDays),
      absoluteExpiresAt: addDays(absoluteDays),
      lastUsedAt: new Date(),
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    sid: session.id,
    authVersion: user.authVersion,
  });

  return { accessToken, refreshToken, session, rememberMe };
}

export async function revokeUserSessions(
  userId: string,
  reason: string,
  exceptSessionId?: string,
) {
  await prisma.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}

export async function bumpAuthVersion(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      authVersion: { increment: 1 },
      passwordChangedAt: new Date(),
    },
  });
}
