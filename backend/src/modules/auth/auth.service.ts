import type { Request } from "express";
import { prisma } from "../../config/database.js";
import { getEnv } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { ConflictError, UnauthorizedError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  createTokenFamilyId,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from "../../lib/tokens.js";
import { PERMISSIONS, ROLE_PERMISSION_MAP, SYSTEM_ROLE_KEYS } from "./permissions.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

const REFRESH_COOKIE_NAME = "refreshToken";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base || "company";
  let suffix = 1;

  while (true) {
    const existing = await prisma.company.findUnique({
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

async function ensurePermissionCatalog() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: {
        key: permission.key,
        description: permission.description,
      },
    });
  }
}

async function createCompanyRoles(companyId: string) {
  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.key, permission.id]),
  );

  const roles = [];

  for (const roleKey of SYSTEM_ROLE_KEYS) {
    const role = await prisma.role.create({
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
              if (!permissionId) {
                return null;
              }

              return { permissionId };
            })
            .filter((item): item is { permissionId: string } => Boolean(item)),
        },
      },
    });

    roles.push(role);
  }

  return roles;
}

function getRefreshExpiryDate(): Date {
  const env = getEnv();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);
  return expiresAt;
}

async function issueTokenPair(
  user: { id: string; email: string; fullName: string },
  req: Request,
  familyId = createTokenFamilyId(),
) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
  });
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash,
      expiresAt: getRefreshExpiryDate(),
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    },
  });

  return { accessToken, refreshToken };
}

export function getRefreshCookieOptions() {
  const env = getEnv();

  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  } as const;
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE_NAME;
}

export class AuthService {
  async register(input: RegisterInput, req: Request) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError("Email is already registered");
    }

    await ensurePermissionCatalog();

    const passwordHash = await hashPassword(input.password);
    const slug = await ensureUniqueSlug(slugify(input.companyName));

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
        },
      });

      const company = await tx.company.create({
        data: {
          name: input.companyName,
          slug,
          ownerId: user.id,
        },
      });

      const permissions = await tx.permission.findMany();
      const permissionByKey = new Map(
        permissions.map((permission) => [permission.key, permission.id]),
      );

      const roles = [];
      for (const roleKey of SYSTEM_ROLE_KEYS) {
        const role = await tx.role.create({
          data: {
            companyId: company.id,
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

      const ownerRole = roles.find((role) => role.key === "owner");
      if (!ownerRole) {
        throw new Error("Owner role was not created");
      }

      const membership = await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId: user.id,
          roleId: ownerRole.id,
          status: "ACTIVE",
        },
      });

      return { user, company, membership };
    });

    const tokens = await issueTokenPair(result.user, req);

    logger.info(
      {
        requestId: req.requestId,
        userId: result.user.id,
        companyId: result.company.id,
        event: "auth.register",
      },
      "User registered",
    );

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
      },
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput, req: Request) {
    const user = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const tokens = await issueTokenPair(user, req);

    logger.info(
      {
        requestId: req.requestId,
        userId: user.id,
        event: "auth.login",
      },
      "User logged in",
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      ...tokens,
    };
  }

  async refresh(req: Request) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== "string") {
      throw new UnauthorizedError("Refresh token is required");
    }

    const tokenHash = hashToken(rawToken);
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (session.revokedAt) {
      await prisma.refreshSession.updateMany({
        where: {
          familyId: session.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      logger.warn(
        {
          requestId: req.requestId,
          userId: session.userId,
          familyId: session.familyId,
          event: "auth.refresh_reuse",
        },
        "Refresh token reuse detected",
      );

      throw new UnauthorizedError("Refresh token has been revoked");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token expired");
    }

    if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
      throw new UnauthorizedError("User is not active");
    }

    const nextRefreshToken = generateRefreshToken();
    const nextHash = hashToken(nextRefreshToken);

    await prisma.$transaction([
      prisma.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: nextHash,
        },
      }),
      prisma.refreshSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: nextHash,
          expiresAt: getRefreshExpiryDate(),
          userAgent: req.get("user-agent") ?? undefined,
          ipAddress: req.ip,
        },
      }),
    ]);

    const accessToken = signAccessToken({
      sub: session.user.id,
      email: session.user.email,
    });

    logger.info(
      {
        requestId: req.requestId,
        userId: session.userId,
        event: "auth.refresh",
      },
      "Access token refreshed",
    );

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
      },
    };
  }

  async logout(req: Request) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== "string") {
      return;
    }

    const tokenHash = hashToken(rawToken);
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (!session || session.revokedAt) {
      return;
    }

    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    logger.info(
      {
        requestId: req.requestId,
        userId: session.userId,
        event: "auth.logout",
      },
      "User logged out",
    );
  }

  async me(userId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        memberships: {
          where: {
            deletedAt: null,
            status: "ACTIVE",
          },
          include: {
            company: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError();
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      companies: user.memberships.map((membership) => ({
        id: membership.company.id,
        name: membership.company.name,
        slug: membership.company.slug,
        roleKey: membership.role.key,
        membershipId: membership.id,
      })),
    };
  }
}

export const authService = new AuthService();

// Keep helper available for tests/seeds that create companies outside register.
export { createCompanyRoles, ensurePermissionCatalog };
