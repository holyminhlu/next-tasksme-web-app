import type { Request } from "express";
import { prisma } from "../../config/database.js";
import { getEnv } from "../../config/env.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
} from "../../lib/tokens.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { getEmailService } from "../../services/email/index.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SelectWorkspaceInput,
  VerifyEmailInput,
} from "./auth.schemas.js";
import {
  REFRESH_COOKIE_NAME,
  addDays,
  addHours,
  bumpAuthVersion,
  ensurePermissionCatalog,
  getClientMeta,
  issueTokenPair,
  revokeUserSessions,
} from "./auth.helpers.js";

const GENERIC_LOGIN_ERROR = "Invalid email or password";
const GENERIC_EMAIL_SENT =
  "If an account exists for this email, further instructions have been sent.";

function mapWorkspaceMembership(membership: {
  id: string;
  role: { key: string };
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: string;
  };
  onboarding?: {
    status: string;
    currentStep: string;
  } | null;
}) {
  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    type: membership.workspace.type,
    roleKey: membership.role.key,
    membershipId: membership.id,
    onboardingStatus: membership.onboarding?.status ?? null,
    currentStep: membership.onboarding?.currentStep ?? null,
  };
}

export class AuthService {
  async register(input: RegisterInput, req: Request) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError("Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const env = getEnv();
    const requireVerification = env.REQUIRE_EMAIL_VERIFICATION;
    const verificationToken = requireVerification
      ? generateOpaqueToken()
      : null;

    const user = await prisma.$transaction(async (tx) => {
      await ensurePermissionCatalog(tx);

      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          status: requireVerification ? "PENDING_VERIFICATION" : "ACTIVE",
          emailVerifiedAt: requireVerification ? null : new Date(),
        },
      });

      if (requireVerification && verificationToken) {
        await tx.oneTimeToken.create({
          data: {
            userId: created.id,
            type: "EMAIL_VERIFICATION",
            tokenHash: hashToken(verificationToken),
            expiresAt: addHours(env.EMAIL_VERIFICATION_TTL_HOURS),
          },
        });
      }

      return created;
    });

    if (requireVerification && verificationToken) {
      const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await getEmailService().send({
        to: user.email,
        subject: "Verify your TaskMng email",
        text: `Verify your email: ${verifyUrl}`,
        html: `<p>Welcome to TaskMng.</p><p><a href="${verifyUrl}">Verify your email</a></p>`,
      });
    }

    await writeAuditLog({
      action: "auth.register",
      userId: user.id,
      entityType: "user",
      entityId: user.id,
      metadata: { requireEmailVerification: requireVerification },
      ...getClientMeta(req),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
      },
      requiresEmailVerification: requireVerification,
    };
  }

  async verifyEmail(input: VerifyEmailInput, req: Request) {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.type !== "EMAIL_VERIFICATION") {
      throw new ValidationError("Invalid or expired verification token");
    }

    if (record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Invalid or expired verification token");
    }

    await prisma.$transaction([
      prisma.oneTimeToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: {
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
    ]);

    await writeAuditLog({
      action: "auth.verify_email",
      userId: record.userId,
      entityType: "user",
      entityId: record.userId,
      ...getClientMeta(req),
    });

    return { verified: true };
  }

  async resendVerification(input: ResendVerificationInput, req: Request) {
    const env = getEnv();

    if (!env.REQUIRE_EMAIL_VERIFICATION) {
      return { message: GENERIC_EMAIL_SENT };
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (user && user.status === "PENDING_VERIFICATION" && !user.deletedAt) {
      const token = generateOpaqueToken();

      await prisma.oneTimeToken.updateMany({
        where: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      await prisma.oneTimeToken.create({
        data: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          tokenHash: hashToken(token),
          expiresAt: addHours(env.EMAIL_VERIFICATION_TTL_HOURS),
        },
      });

      const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
      await getEmailService().send({
        to: user.email,
        subject: "Verify your TaskMng email",
        text: `Verify your email: ${verifyUrl}`,
        html: `<p><a href="${verifyUrl}">Verify your email</a></p>`,
      });

      await writeAuditLog({
        action: "auth.resend_verification",
        userId: user.id,
        ...getClientMeta(req),
      });
    }

    return { message: GENERIC_EMAIL_SENT };
  }

  async login(input: LoginInput, req: Request) {
    const env = getEnv();
    const user = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
    });

    if (!user) {
      await writeAuditLog({
        action: "auth.login_failed",
        metadata: { reason: "unknown_email" },
        ...getClientMeta(req),
      });
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await writeAuditLog({
        action: "auth.login_locked",
        userId: user.id,
        ...getClientMeta(req),
      });
      throw new ForbiddenError("Account is temporarily locked");
    }

    if (user.status === "DISABLED") {
      throw new ForbiddenError("Account is disabled");
    }

    if (user.status === "PENDING_VERIFICATION") {
      if (env.REQUIRE_EMAIL_VERIFICATION) {
        throw new ForbiddenError("Email verification is required");
      }

      // Verification temporarily disabled: activate leftover pending accounts on login.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    }

    if (user.status === "LOCKED") {
      throw new ForbiddenError("Account is locked");
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          status: shouldLock ? "LOCKED" : user.status,
          lockedUntil: shouldLock
            ? addHours(env.ACCOUNT_LOCK_MINUTES / 60)
            : null,
        },
      });

      await writeAuditLog({
        action: shouldLock ? "auth.account_locked" : "auth.login_failed",
        userId: user.id,
        metadata: { attempts },
        ...getClientMeta(req),
      });

      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: "ACTIVE",
        lastLoginAt: new Date(),
      },
    });

    const tokens = await issueTokenPair(updatedUser, req, {
      rememberMe: input.rememberMe,
    });

    await writeAuditLog({
      action: "auth.login",
      userId: user.id,
      entityType: "refresh_session",
      entityId: tokens.session.id,
      ...getClientMeta(req),
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      rememberMe: tokens.rememberMe,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        status: updatedUser.status,
      },
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
          revokeReason: "reuse_detected",
        },
      });

      await writeAuditLog({
        action: "auth.refresh_reuse",
        userId: session.userId,
        entityType: "refresh_family",
        entityId: session.familyId,
        ...getClientMeta(req),
      });

      throw new UnauthorizedError("Refresh token has been revoked");
    }

    if (
      session.expiresAt.getTime() < Date.now() ||
      session.absoluteExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedError("Refresh token expired");
    }

    if (
      session.user.status !== "ACTIVE" ||
      session.user.deletedAt ||
      session.user.lockedUntil
    ) {
      throw new UnauthorizedError("User is not active");
    }

    const nextRefreshToken = generateOpaqueToken();
    const nextHash = hashToken(nextRefreshToken);
    const env = getEnv();
    const rollingDays = session.rememberMe
      ? env.REFRESH_TOKEN_REMEMBER_DAYS
      : env.REFRESH_TOKEN_EXPIRES_DAYS;

    const rotated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          tokenHash,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: "rotated",
          replacedByTokenHash: nextHash,
        },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const nextSession = await tx.refreshSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: nextHash,
          rememberMe: session.rememberMe,
          expiresAt: addDays(rollingDays),
          absoluteExpiresAt: session.absoluteExpiresAt,
          lastUsedAt: new Date(),
          userAgent: req.get("user-agent") ?? undefined,
          ipAddress: req.ip,
        },
      });

      return nextSession;
    });

    if (!rotated) {
      throw new UnauthorizedError("Refresh token has been revoked");
    }

    const accessToken = signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      sid: rotated.id,
      authVersion: session.user.authVersion,
    });

    await writeAuditLog({
      action: "auth.refresh",
      userId: session.userId,
      entityType: "refresh_session",
      entityId: rotated.id,
      ...getClientMeta(req),
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      rememberMe: session.rememberMe,
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        status: session.user.status,
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
      data: {
        revokedAt: new Date(),
        revokeReason: "logout",
      },
    });

    await writeAuditLog({
      action: "auth.logout",
      userId: session.userId,
      entityType: "refresh_session",
      entityId: session.id,
      ...getClientMeta(req),
    });
  }

  async logoutAll(userId: string, req: Request) {
    await revokeUserSessions(userId, "logout_all");
    await bumpAuthVersion(userId);

    await writeAuditLog({
      action: "auth.logout_all",
      userId,
      ...getClientMeta(req),
    });

    return { loggedOutAll: true };
  }

  async forgotPassword(input: ForgotPasswordInput, req: Request) {
    const user = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
    });

    if (user && user.status !== "DISABLED") {
      const env = getEnv();
      const token = generateOpaqueToken();

      await prisma.oneTimeToken.updateMany({
        where: {
          userId: user.id,
          type: "PASSWORD_RESET",
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      await prisma.oneTimeToken.create({
        data: {
          userId: user.id,
          type: "PASSWORD_RESET",
          tokenHash: hashToken(token),
          expiresAt: addHours(env.PASSWORD_RESET_TTL_HOURS),
        },
      });

      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
      await getEmailService().send({
        to: user.email,
        subject: "Reset your TaskMng password",
        text: `Reset your password: ${resetUrl}`,
        html: `<p><a href="${resetUrl}">Reset your password</a></p>`,
      });

      await writeAuditLog({
        action: "auth.forgot_password",
        userId: user.id,
        ...getClientMeta(req),
      });
    } else {
      await writeAuditLog({
        action: "auth.forgot_password",
        metadata: { reason: "unknown_or_disabled" },
        ...getClientMeta(req),
      });
    }

    return { message: GENERIC_EMAIL_SENT };
  }

  async resetPassword(input: ResetPasswordInput, req: Request) {
    const tokenHash = hashToken(input.token);
    const record = await prisma.oneTimeToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.type !== "PASSWORD_RESET") {
      throw new ValidationError("Invalid or expired reset token");
    }

    if (record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new ValidationError("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(input.password);

    await prisma.$transaction(async (tx) => {
      await tx.oneTimeToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          authVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
          status:
            record.user.status === "LOCKED" ? "ACTIVE" : record.user.status,
        },
      });

      await tx.refreshSession.updateMany({
        where: {
          userId: record.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: "password_reset",
        },
      });
    });

    await writeAuditLog({
      action: "auth.reset_password",
      userId: record.userId,
      ...getClientMeta(req),
    });

    return { reset: true };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    req: Request,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError();
    }

    const valid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          authVersion: { increment: 1 },
        },
      });

      await tx.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: "password_change",
        },
      });
    });

    await writeAuditLog({
      action: "auth.change_password",
      userId,
      ...getClientMeta(req),
    });

    return { changed: true };
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
            workspace: {
              deletedAt: null,
              status: "ACTIVE",
            },
          },
          include: {
            workspace: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError();
    }

    const onboardings = await prisma.workspaceOnboarding.findMany({
      where: {
        userId,
        workspaceId: {
          in: user.memberships.map((membership) => membership.workspaceId),
        },
      },
    });
    const onboardingByWorkspace = new Map(
      onboardings.map((item) => [item.workspaceId, item]),
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastActiveWorkspaceId: user.lastActiveWorkspaceId,
      workspaces: user.memberships.map((membership) =>
        mapWorkspaceMembership({
          ...membership,
          onboarding: onboardingByWorkspace.get(membership.workspaceId) ?? null,
        }),
      ),
    };
  }

  async listWorkspaces(userId: string) {
    const profile = await this.me(userId);
    return profile.workspaces;
  }

  async selectWorkspace(
    userId: string,
    input: SelectWorkspaceInput,
    req: Request,
  ) {
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: input.workspaceId,
        deletedAt: null,
        status: "ACTIVE",
        workspace: {
          deletedAt: null,
          status: "ACTIVE",
        },
      },
      include: {
        workspace: true,
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this workspace");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveWorkspaceId: membership.workspaceId },
    });

    const onboarding = await prisma.workspaceOnboarding.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId,
        },
      },
    });

    await writeAuditLog({
      action: "auth.select_workspace",
      userId,
      workspaceId: membership.workspaceId,
      ...getClientMeta(req),
    });

    return mapWorkspaceMembership({
      ...membership,
      onboarding,
    });
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await prisma.refreshSession.findMany({
      where: {
        userId,
        revokedAt: null,
        absoluteExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        familyId: true,
        rememberMe: true,
        expiresAt: true,
        absoluteExpiresAt: true,
        lastUsedAt: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string, req: Request) {
    const session = await prisma.refreshSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundError("Session not found");
    }

    if (!session.revokedAt) {
      await prisma.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokeReason: "user_revoked",
        },
      });
    }

    await writeAuditLog({
      action: "auth.revoke_session",
      userId,
      entityType: "refresh_session",
      entityId: session.id,
      ...getClientMeta(req),
    });

    return { revoked: true };
  }
}

export const authService = new AuthService();

export { REFRESH_COOKIE_NAME };
