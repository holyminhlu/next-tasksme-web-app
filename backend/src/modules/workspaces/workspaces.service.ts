import type { Request } from "express";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { getEnv } from "../../config/env.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import {
  buildPaginationMeta,
  getPagination,
  type PaginationQuery,
} from "../../lib/pagination.js";
import { hashPassword } from "../../lib/password.js";
import { generateOpaqueToken, hashToken } from "../../lib/tokens.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { recordActivity } from "../../services/activity.service.js";
import { getEmailService } from "../../services/email/index.js";
import {
  addHours,
  createWorkspaceRoles,
  ensurePermissionCatalog,
  ensureUniqueSlug,
  getClientMeta,
  slugify,
} from "../auth/auth.helpers.js";
import type { SystemRoleKey } from "../auth/permissions.js";
import {
  MODULE_CATALOG,
  MODULE_PRESETS,
  defaultModulesForWorkspaceType,
  initialOnboardingStep,
  type ModulePresetKey,
} from "./modules.catalog.js";
import {
  assertCanModifyMember,
  assertNotLastOwner,
  lockWorkspace,
} from "./owner.policy.js";
import type {
  ApplyModulePresetInput,
  CreateFirstProjectInput,
  CreateWorkspaceInput,
  UpdateModulesInput,
  UpdateOnboardingInput,
  UpdateWorkspaceInput,
} from "./workspaces.schemas.js";

function asCompletedSteps(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function defaultWorkspaceName(
  type: "PERSONAL" | "ORGANIZATION",
  fullName: string,
  provided?: string,
) {
  if (provided?.trim()) {
    return provided.trim();
  }

  if (type === "PERSONAL") {
    const firstName = fullName.trim().split(/\s+/)[0] || "User";
    return `My Workspace (${firstName})`;
  }

  return `${fullName.trim()}'s Organization`;
}

export class WorkspacesService {
  async createWorkspace(
    userId: string,
    input: CreateWorkspaceInput,
    req: Request,
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: "ACTIVE" },
    });

    if (!user) {
      throw new ForbiddenError("Active user required");
    }

    const name = defaultWorkspaceName(input.type, user.fullName, input.name);
    const onboardingType =
      input.type === "PERSONAL" ? "PERSONAL_OWNER" : "ORGANIZATION_OWNER";

    const result = await prisma.$transaction(async (tx) => {
      await ensurePermissionCatalog(tx);

      const slug = await ensureUniqueSlug(slugify(name), tx);
      const workspace = await tx.workspace.create({
        data: {
          name,
          slug,
          type: input.type,
          ownerId: userId,
          usagePurpose: input.usagePurpose,
          industryCode:
            input.type === "ORGANIZATION" ? input.industryCode : undefined,
          companySize:
            input.type === "ORGANIZATION" ? input.companySize : undefined,
          timezone: input.timezone ?? "UTC",
          locale: input.locale ?? "vi",
          logoUrl: input.logoUrl,
        },
      });

      const roles = await createWorkspaceRoles(workspace.id, tx);
      const ownerRole = roles.find((role) => role.key === "owner");
      if (!ownerRole) {
        throw new Error("Owner role was not created");
      }

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          roleId: ownerRole.id,
          status: "ACTIVE",
        },
      });

      const modules = defaultModulesForWorkspaceType(input.type);
      await tx.workspaceModule.createMany({
        data: modules.map((module) => ({
          workspaceId: workspace.id,
          moduleKey: module.moduleKey,
          enabled: module.enabled,
          core: module.core,
        })),
      });

      const onboarding = await tx.workspaceOnboarding.create({
        data: {
          workspaceId: workspace.id,
          userId,
          onboardingType,
          status: "IN_PROGRESS",
          currentStep: initialOnboardingStep(onboardingType),
          completedSteps: [],
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { lastActiveWorkspaceId: workspace.id },
      });

      return { workspace, onboarding };
    });

    await writeAuditLog({
      action: "workspace.create",
      userId,
      workspaceId: result.workspace.id,
      entityType: "workspace",
      entityId: result.workspace.id,
      metadata: { type: input.type },
      ...getClientMeta(req),
    });

    return {
      ...result.workspace,
      onboarding: {
        status: result.onboarding.status,
        currentStep: result.onboarding.currentStep,
        onboardingType: result.onboarding.onboardingType,
      },
    };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
      },
    });

    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    return workspace;
  }

  async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceInput,
    actorId: string,
    req: Request,
  ) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({
        where: { id: workspaceId, deletedAt: null },
      });

      if (!workspace) {
        throw new NotFoundError("Workspace not found");
      }

      if (input.type && input.type !== workspace.type) {
        if (input.type === "PERSONAL") {
          const memberCount = await tx.workspaceMember.count({
            where: {
              workspaceId,
              deletedAt: null,
              status: "ACTIVE",
            },
          });
          if (memberCount > 1) {
            throw new ForbiddenError(
              "Cannot convert an organization with multiple members to personal",
            );
          }
        }

        if (
          workspace.type === "PERSONAL" &&
          input.type === "ORGANIZATION"
        ) {
          const memberCount = await tx.workspaceMember.count({
            where: {
              workspaceId,
              deletedAt: null,
              status: "ACTIVE",
            },
          });
          if (memberCount !== 1) {
            throw new ForbiddenError(
              "Personal workspace can convert to organization only with a single member",
            );
          }
        }
      }

      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          name: input.name,
          type: input.type,
          usagePurpose: input.usagePurpose,
          industryCode: input.industryCode,
          companySize: input.companySize,
          timezone: input.timezone,
          locale: input.locale,
          logoUrl: input.logoUrl,
        },
      });

      await writeAuditLog({
        action: "workspace.update",
        userId: actorId,
        workspaceId,
        entityType: "workspace",
        entityId: workspaceId,
        metadata: input,
        ...getClientMeta(req),
      });

      return updated;
    });
  }

  async listMembers(workspaceId: string, query: PaginationQuery) {
    const pagination = getPagination(query);

    const where = {
      workspaceId,
      deletedAt: null,
      ...(pagination.search
        ? {
            OR: [
              {
                user: {
                  fullName: {
                    contains: pagination.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: pagination.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, members] = await Promise.all([
      prisma.workspaceMember.count({ where }),
      prisma.workspaceMember.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: {
          createdAt: pagination.sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              status: true,
            },
          },
          role: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      members: members.map((member) => ({
        id: member.id,
        status: member.status,
        user: member.user,
        role: member.role,
        createdAt: member.createdAt,
      })),
      pagination: buildPaginationMeta(
        pagination.page,
        pagination.pageSize,
        total,
      ),
    };
  }

  async inviteMember(
    workspaceId: string,
    actor: { id: string; roleKey: string },
    input: { email: string; roleKey: string },
    req: Request,
  ) {
    const workspace = await this.getWorkspace(workspaceId);
    if (workspace.type !== "ORGANIZATION") {
      throw new ForbiddenError(
        "Personal workspaces cannot invite members until converted to an organization",
      );
    }

    if (actor.roleKey === "manager" && input.roleKey !== "member") {
      throw new ForbiddenError("Managers can only invite members");
    }

    if (actor.roleKey !== "owner" && input.roleKey === "admin") {
      throw new ForbiddenError("Only owners can invite admins");
    }

    const role = await prisma.role.findFirst({
      where: {
        workspaceId,
        key: input.roleKey,
      },
    });

    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        deletedAt: null,
        user: {
          email: input.email,
        },
      },
    });

    if (existingMember) {
      throw new ConflictError("User is already a workspace member");
    }

    const env = getEnv();
    const token = generateOpaqueToken();

    await prisma.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        email: input.email,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: input.email,
        roleId: role.id,
        invitedById: actor.id,
        tokenHash: hashToken(token),
        expiresAt: addHours(env.INVITATION_TTL_HOURS),
      },
      include: {
        workspace: true,
        role: true,
      },
    });

    const inviteUrl = `${env.FRONTEND_URL}/invite/${token}`;
    await getEmailService().send({
      to: input.email,
      subject: `Invitation to join ${invitation.workspace.name}`,
      text: `You have been invited to join ${invitation.workspace.name} as ${invitation.role.name}. Accept: ${inviteUrl}`,
      html: `<p>You have been invited to join <strong>${invitation.workspace.name}</strong> as ${invitation.role.name}.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    });

    await writeAuditLog({
      action: "workspace.invite_member",
      userId: actor.id,
      workspaceId,
      entityType: "workspace_invitation",
      entityId: invitation.id,
      metadata: { email: input.email, roleKey: input.roleKey },
      ...getClientMeta(req),
    });

    return {
      id: invitation.id,
      email: invitation.email,
      roleKey: invitation.role.key,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    };
  }

  async getInvitationByToken(token: string) {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        workspace: true,
        role: true,
      },
    });

    if (!invitation || invitation.status !== "PENDING") {
      throw new NotFoundError("Invitation not found");
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new ValidationError("Invitation has expired");
    }

    return {
      email: invitation.email,
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
        slug: invitation.workspace.slug,
        type: invitation.workspace.type,
      },
      roleKey: invitation.role.key,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(
    token: string,
    input: { fullName?: string; password?: string },
    req: Request,
    currentUserId?: string,
  ) {
    const tokenHash = hashToken(token);
    const passwordHash =
      input.password !== undefined ? await hashPassword(input.password) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findUnique({
        where: { tokenHash },
        include: {
          workspace: true,
          role: true,
        },
      });

      if (!invitation || invitation.status !== "PENDING") {
        throw new NotFoundError("Invitation not found");
      }

      if (invitation.expiresAt.getTime() < Date.now()) {
        await tx.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new ValidationError("Invitation has expired");
      }

      if (invitation.workspace.type !== "ORGANIZATION") {
        throw new ForbiddenError("Invitations are only valid for organizations");
      }

      let user = currentUserId
        ? await tx.user.findUnique({ where: { id: currentUserId } })
        : await tx.user.findUnique({ where: { email: invitation.email } });

      if (currentUserId && user && user.email !== invitation.email) {
        throw new ForbiddenError("Invitation email does not match current user");
      }

      if (!user) {
        if (!input.fullName || !passwordHash) {
          throw new ValidationError(
            "fullName and password are required for new users",
          );
        }

        user = await tx.user.create({
          data: {
            email: invitation.email,
            fullName: input.fullName,
            passwordHash,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });
      }

      const existingMembership = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
      });

      if (existingMembership && !existingMembership.deletedAt) {
        throw new ConflictError("User is already a workspace member");
      }

      if (existingMembership) {
        await tx.workspaceMember.update({
          where: { id: existingMembership.id },
          data: {
            roleId: invitation.roleId,
            status: "ACTIVE",
            deletedAt: null,
          },
        });
      } else {
        await tx.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
            roleId: invitation.roleId,
            status: "ACTIVE",
          },
        });
      }

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      const onboardingType =
        invitation.role.key === "manager"
          ? "INVITED_MANAGER"
          : "INVITED_MEMBER";

      await tx.workspaceOnboarding.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          onboardingType,
          status: "IN_PROGRESS",
          currentStep: initialOnboardingStep(onboardingType),
          completedSteps: [],
        },
        update: {},
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveWorkspaceId: invitation.workspaceId },
      });

      return {
        workspaceId: invitation.workspaceId,
        roleKey: invitation.role.key,
        userId: user.id,
        invitationId: invitation.id,
      };
    });

    await writeAuditLog({
      action: "workspace.accept_invitation",
      userId: result.userId,
      workspaceId: result.workspaceId,
      entityType: "workspace_invitation",
      entityId: result.invitationId,
      ...getClientMeta(req),
    });

    return {
      workspaceId: result.workspaceId,
      roleKey: result.roleKey,
      userId: result.userId,
    };
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actorId: string,
    req: Request,
  ) {
    const invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
        status: "PENDING",
      },
    });

    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    await writeAuditLog({
      action: "workspace.revoke_invitation",
      userId: actorId,
      workspaceId,
      entityType: "workspace_invitation",
      entityId: invitation.id,
      ...getClientMeta(req),
    });

    return { revoked: true };
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    nextRoleKey: SystemRoleKey,
    actor: { id: string; roleKey: string },
    req: Request,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);

      const member = await tx.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId,
          deletedAt: null,
        },
        include: { role: true },
      });

      if (!member) {
        throw new NotFoundError("Member not found");
      }

      const nextRole = await tx.role.findFirst({
        where: {
          workspaceId,
          key: nextRoleKey,
        },
      });

      if (!nextRole) {
        throw new NotFoundError("Role not found");
      }

      await assertCanModifyMember({
        actorRoleKey: actor.roleKey,
        targetRoleKey: member.role.key,
        nextRoleKey,
        isSelf: member.userId === actor.id,
      });

      await assertNotLastOwner(tx, workspaceId, member.role.key, nextRoleKey);

      const updated = await tx.workspaceMember.update({
        where: { id: member.id },
        data: { roleId: nextRole.id },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      await writeAuditLog({
        action: "workspace.update_member_role",
        userId: actor.id,
        workspaceId,
        entityType: "workspace_member",
        entityId: member.id,
        metadata: {
          from: member.role.key,
          to: nextRoleKey,
        },
        ...getClientMeta(req),
      });

      return updated;
    });
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    actor: { id: string; roleKey: string },
    req: Request,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);

      const member = await tx.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId,
          deletedAt: null,
        },
        include: { role: true },
      });

      if (!member) {
        throw new NotFoundError("Member not found");
      }

      await assertCanModifyMember({
        actorRoleKey: actor.roleKey,
        targetRoleKey: member.role.key,
        isSelf: member.userId === actor.id,
      });

      await assertNotLastOwner(tx, workspaceId, member.role.key, "member");

      await tx.workspaceMember.update({
        where: { id: member.id },
        data: {
          status: "DISABLED",
          deletedAt: new Date(),
        },
      });

      await writeAuditLog({
        action: "workspace.remove_member",
        userId: actor.id,
        workspaceId,
        entityType: "workspace_member",
        entityId: member.id,
        ...getClientMeta(req),
      });

      return { removed: true };
    });
  }

  async transferOwnership(
    workspaceId: string,
    memberId: string,
    actor: { id: string; roleKey: string },
    req: Request,
  ) {
    if (actor.roleKey !== "owner") {
      throw new ForbiddenError("Only owners can transfer ownership");
    }

    return prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);

      const target = await tx.workspaceMember.findFirst({
        where: {
          id: memberId,
          workspaceId,
          deletedAt: null,
          status: "ACTIVE",
        },
        include: { role: true },
      });

      if (!target) {
        throw new NotFoundError("Member not found");
      }

      if (target.userId === actor.id) {
        throw new ValidationError("Cannot transfer ownership to yourself");
      }

      const ownerRole = await tx.role.findFirst({
        where: { workspaceId, key: "owner" },
      });
      const adminRole = await tx.role.findFirst({
        where: { workspaceId, key: "admin" },
      });

      if (!ownerRole || !adminRole) {
        throw new Error("System roles missing");
      }

      const currentOwnerMembership = await tx.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: actor.id,
          deletedAt: null,
        },
      });

      if (!currentOwnerMembership) {
        throw new ForbiddenError("Current owner membership not found");
      }

      await tx.workspaceMember.update({
        where: { id: currentOwnerMembership.id },
        data: { roleId: adminRole.id },
      });

      await tx.workspaceMember.update({
        where: { id: target.id },
        data: { roleId: ownerRole.id },
      });

      await tx.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: target.userId },
      });

      await writeAuditLog({
        action: "workspace.transfer_ownership",
        userId: actor.id,
        workspaceId,
        entityType: "workspace",
        entityId: workspaceId,
        metadata: { newOwnerId: target.userId },
        ...getClientMeta(req),
      });

      return { transferred: true, ownerId: target.userId };
    });
  }

  async getOnboarding(workspaceId: string, userId: string) {
    const onboarding = await prisma.workspaceOnboarding.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!onboarding) {
      throw new NotFoundError("Onboarding not found");
    }

    return {
      ...onboarding,
      completedSteps: asCompletedSteps(onboarding.completedSteps),
    };
  }

  async updateOnboarding(
    workspaceId: string,
    userId: string,
    input: UpdateOnboardingInput,
    req: Request,
  ) {
    const existing = await this.getOnboarding(workspaceId, userId);
    if (existing.status === "COMPLETED") {
      throw new ValidationError("Onboarding is already completed");
    }

    let completedSteps = asCompletedSteps(existing.completedSteps);
    if (input.completedSteps) {
      completedSteps = [...new Set(input.completedSteps)];
    }
    if (input.markStepCompleted) {
      completedSteps = [...new Set([...completedSteps, input.markStepCompleted])];
    }

    const result = await prisma.$transaction(async (tx) => {
      if (input.workspace) {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            name: input.workspace.name,
            usagePurpose: input.workspace.usagePurpose,
            industryCode: input.workspace.industryCode,
            companySize: input.workspace.companySize,
            timezone: input.workspace.timezone,
            locale: input.workspace.locale,
            logoUrl: input.workspace.logoUrl,
          },
        });
      }

      return tx.workspaceOnboarding.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
        data: {
          currentStep: input.currentStep ?? existing.currentStep,
          completedSteps,
        },
      });
    });

    await writeAuditLog({
      action: "workspace.onboarding_progress",
      userId,
      workspaceId,
      entityType: "workspace_onboarding",
      entityId: result.id,
      metadata: {
        currentStep: result.currentStep,
        completedSteps,
      },
      ...getClientMeta(req),
    });

    return {
      ...result,
      completedSteps: asCompletedSteps(result.completedSteps),
    };
  }

  async completeOnboarding(
    workspaceId: string,
    userId: string,
    req: Request,
  ) {
    const existing = await this.getOnboarding(workspaceId, userId);
    if (existing.status === "COMPLETED") {
      return existing;
    }

    const completed = await prisma.workspaceOnboarding.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        status: "COMPLETED",
        currentStep: "complete",
        completedAt: new Date(),
        completedSteps: [
          ...new Set([...asCompletedSteps(existing.completedSteps), "complete"]),
        ],
      },
    });

    await writeAuditLog({
      action: "workspace.onboarding_complete",
      userId,
      workspaceId,
      entityType: "workspace_onboarding",
      entityId: completed.id,
      ...getClientMeta(req),
    });

    return {
      ...completed,
      completedSteps: asCompletedSteps(completed.completedSteps),
    };
  }

  async listModules(workspaceId: string) {
    const modules = await prisma.workspaceModule.findMany({
      where: { workspaceId },
      orderBy: { moduleKey: "asc" },
    });

    const catalogByKey = new Map(
      MODULE_CATALOG.map((item) => [item.key, item]),
    );

    return modules.map((module) => ({
      ...module,
      name: catalogByKey.get(module.moduleKey as never)?.name ?? module.moduleKey,
      description:
        catalogByKey.get(module.moduleKey as never)?.description ?? null,
    }));
  }

  async applyModulePreset(
    workspaceId: string,
    input: ApplyModulePresetInput,
    actorId: string,
    req: Request,
  ) {
    const preset = MODULE_PRESETS[input.presetKey as ModulePresetKey];
    const enabled = new Set(preset.enabledKeys);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceModule.findMany({
        where: { workspaceId },
      });

      for (const module of existing) {
        const catalog = MODULE_CATALOG.find(
          (item) => item.key === module.moduleKey,
        );
        const nextEnabled = catalog?.core
          ? true
          : enabled.has(module.moduleKey as never);

        await tx.workspaceModule.update({
          where: { id: module.id },
          data: { enabled: nextEnabled },
        });
      }

      for (const catalogModule of MODULE_CATALOG) {
        const found = existing.find(
          (item) => item.moduleKey === catalogModule.key,
        );
        if (!found) {
          await tx.workspaceModule.create({
            data: {
              workspaceId,
              moduleKey: catalogModule.key,
              core: catalogModule.core,
              enabled:
                catalogModule.core || enabled.has(catalogModule.key),
            },
          });
        }
      }
    });

    await writeAuditLog({
      action: "workspace.modules_preset",
      userId: actorId,
      workspaceId,
      entityType: "workspace",
      entityId: workspaceId,
      metadata: { presetKey: input.presetKey },
      ...getClientMeta(req),
    });

    return this.listModules(workspaceId);
  }

  async updateModules(
    workspaceId: string,
    input: UpdateModulesInput,
    actorId: string,
    req: Request,
  ) {
    const existing = await prisma.workspaceModule.findMany({
      where: { workspaceId },
    });
    const byKey = new Map(existing.map((item) => [item.moduleKey, item]));

    for (const item of input.modules) {
      const current = byKey.get(item.moduleKey);
      if (!current) {
        throw new ValidationError(`Unknown module: ${item.moduleKey}`);
      }
      if (current.core && !item.enabled) {
        throw new ValidationError(`Core module cannot be disabled: ${item.moduleKey}`);
      }
    }

    await prisma.$transaction(
      input.modules.map((item) =>
        prisma.workspaceModule.update({
          where: {
            workspaceId_moduleKey: {
              workspaceId,
              moduleKey: item.moduleKey,
            },
          },
          data: { enabled: item.enabled },
        }),
      ),
    );

    await writeAuditLog({
      action: "workspace.modules_update",
      userId: actorId,
      workspaceId,
      entityType: "workspace",
      entityId: workspaceId,
      metadata: { modules: input.modules },
      ...getClientMeta(req),
    });

    return this.listModules(workspaceId);
  }

  async createFirstProject(
    workspaceId: string,
    userId: string,
    input: CreateFirstProjectInput,
    req: Request,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          name: input.name,
          description: input.description,
          createdById: userId,
          status: "ACTIVE",
        },
      });

      const tasks = [];
      for (const taskInput of input.tasks ?? []) {
        const task = await tx.task.create({
          data: {
            workspaceId,
            projectId: project.id,
            title: taskInput.title,
            description: taskInput.description,
            priority: taskInput.priority ?? "MEDIUM",
            dueDate: taskInput.dueDate
              ? new Date(taskInput.dueDate)
              : undefined,
            createdById: userId,
            assigneeId: userId,
            status: "TODO",
            source: "ONBOARDING",
          },
        });
        tasks.push(task);
      }

      const onboarding = await tx.workspaceOnboarding.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });

      if (onboarding && onboarding.status !== "COMPLETED") {
        const completedSteps = [
          ...new Set([
            ...asCompletedSteps(onboarding.completedSteps),
            "first_project",
          ]),
        ];
        await tx.workspaceOnboarding.update({
          where: { id: onboarding.id },
          data: {
            completedSteps,
            currentStep:
              onboarding.currentStep === "first_project"
                ? "complete"
                : onboarding.currentStep,
          },
        });
      }

      return { project, tasks };
    });

    await writeAuditLog({
      action: "workspace.first_project_create",
      userId,
      workspaceId,
      entityType: "project",
      entityId: result.project.id,
      metadata: { taskCount: result.tasks.length },
      ...getClientMeta(req),
    });

    await recordActivity({
      workspaceId,
      actorId: userId,
      action: "project.created",
      resourceType: "project",
      resourceId: result.project.id,
      projectId: result.project.id,
      summary: `Created project "${result.project.name}"`,
      metadata: {
        name: result.project.name,
        createdById: userId,
      },
    });

    for (const task of result.tasks) {
      await recordActivity({
        workspaceId,
        actorId: userId,
        action: "task.created",
        resourceType: "task",
        resourceId: task.id,
        projectId: task.projectId,
        summary: `Created task "${task.title}"`,
        metadata: {
          title: task.title,
          status: task.status,
          assigneeId: task.assigneeId,
          createdById: task.createdById,
          source: task.source,
        },
      });
    }

    return result;
  }
}

export const workspacesService = new WorkspacesService();
