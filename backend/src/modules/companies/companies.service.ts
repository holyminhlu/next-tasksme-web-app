import type { Request } from "express";
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
import { getEmailService } from "../../services/email/index.js";
import { getClientMeta } from "../auth/auth.helpers.js";
import { addHours } from "../auth/auth.helpers.js";
import type { SystemRoleKey } from "../auth/permissions.js";
import {
  assertCanModifyMember,
  assertNotLastOwner,
  lockCompany,
} from "./owner.policy.js";

export class CompaniesService {
  async getCompany(companyId: string) {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return company;
  }

  async updateCompany(companyId: string, name: string) {
    return prisma.company.update({
      where: { id: companyId },
      data: { name },
    });
  }

  async listMembers(companyId: string, query: PaginationQuery) {
    const pagination = getPagination(query);

    const where = {
      companyId,
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
      prisma.companyMember.count({ where }),
      prisma.companyMember.findMany({
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
    companyId: string,
    actor: { id: string; roleKey: string },
    input: { email: string; roleKey: string },
    req: Request,
  ) {
    if (actor.roleKey === "manager" && input.roleKey !== "member") {
      throw new ForbiddenError("Managers can only invite members");
    }

    if (actor.roleKey !== "owner" && input.roleKey === "admin") {
      throw new ForbiddenError("Only owners can invite admins");
    }

    const role = await prisma.role.findFirst({
      where: {
        companyId,
        key: input.roleKey,
      },
    });

    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const existingMember = await prisma.companyMember.findFirst({
      where: {
        companyId,
        deletedAt: null,
        user: {
          email: input.email,
        },
      },
    });

    if (existingMember) {
      throw new ConflictError("User is already a company member");
    }

    const env = getEnv();
    const token = generateOpaqueToken();

    await prisma.companyInvitation.updateMany({
      where: {
        companyId,
        email: input.email,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    const invitation = await prisma.companyInvitation.create({
      data: {
        companyId,
        email: input.email,
        roleId: role.id,
        invitedById: actor.id,
        tokenHash: hashToken(token),
        expiresAt: addHours(env.INVITATION_TTL_HOURS),
      },
      include: {
        company: true,
        role: true,
      },
    });

    const inviteUrl = `${env.FRONTEND_URL}/invite/${token}`;
    await getEmailService().send({
      to: input.email,
      subject: `Invitation to join ${invitation.company.name}`,
      text: `You have been invited to join ${invitation.company.name} as ${invitation.role.name}. Accept: ${inviteUrl}`,
      html: `<p>You have been invited to join <strong>${invitation.company.name}</strong> as ${invitation.role.name}.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    });

    await writeAuditLog({
      action: "company.invite_member",
      userId: actor.id,
      companyId,
      entityType: "company_invitation",
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
    const invitation = await prisma.companyInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        company: true,
        role: true,
      },
    });

    if (!invitation || invitation.status !== "PENDING") {
      throw new NotFoundError("Invitation not found");
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      await prisma.companyInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new ValidationError("Invitation has expired");
    }

    return {
      email: invitation.email,
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
        slug: invitation.company.slug,
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
      const invitation = await tx.companyInvitation.findUnique({
        where: { tokenHash },
        include: {
          company: true,
          role: true,
        },
      });

      if (!invitation || invitation.status !== "PENDING") {
        throw new NotFoundError("Invitation not found");
      }

      if (invitation.expiresAt.getTime() < Date.now()) {
        await tx.companyInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new ValidationError("Invitation has expired");
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

      const existingMembership = await tx.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: invitation.companyId,
            userId: user.id,
          },
        },
      });

      if (existingMembership && !existingMembership.deletedAt) {
        throw new ConflictError("User is already a company member");
      }

      if (existingMembership) {
        await tx.companyMember.update({
          where: { id: existingMembership.id },
          data: {
            roleId: invitation.roleId,
            status: "ACTIVE",
            deletedAt: null,
          },
        });
      } else {
        await tx.companyMember.create({
          data: {
            companyId: invitation.companyId,
            userId: user.id,
            roleId: invitation.roleId,
            status: "ACTIVE",
          },
        });
      }

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      return {
        companyId: invitation.companyId,
        roleKey: invitation.role.key,
        userId: user.id,
        invitationId: invitation.id,
      };
    });

    await writeAuditLog({
      action: "company.accept_invitation",
      userId: result.userId,
      companyId: result.companyId,
      entityType: "company_invitation",
      entityId: result.invitationId,
      ...getClientMeta(req),
    });

    return {
      companyId: result.companyId,
      roleKey: result.roleKey,
      userId: result.userId,
    };
  }

  async revokeInvitation(
    companyId: string,
    invitationId: string,
    actorId: string,
    req: Request,
  ) {
    const invitation = await prisma.companyInvitation.findFirst({
      where: {
        id: invitationId,
        companyId,
        status: "PENDING",
      },
    });

    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    await prisma.companyInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    await writeAuditLog({
      action: "company.revoke_invitation",
      userId: actorId,
      companyId,
      entityType: "company_invitation",
      entityId: invitation.id,
      ...getClientMeta(req),
    });

    return { revoked: true };
  }

  async updateMemberRole(
    companyId: string,
    memberId: string,
    nextRoleKey: SystemRoleKey,
    actor: { id: string; roleKey: string },
    req: Request,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockCompany(tx, companyId);

      const member = await tx.companyMember.findFirst({
        where: {
          id: memberId,
          companyId,
          deletedAt: null,
        },
        include: { role: true },
      });

      if (!member) {
        throw new NotFoundError("Member not found");
      }

      const nextRole = await tx.role.findFirst({
        where: {
          companyId,
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

      await assertNotLastOwner(tx, companyId, member.role.key, nextRoleKey);

      const updated = await tx.companyMember.update({
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
        action: "company.update_member_role",
        userId: actor.id,
        companyId,
        entityType: "company_member",
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
    companyId: string,
    memberId: string,
    actor: { id: string; roleKey: string },
    req: Request,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockCompany(tx, companyId);

      const member = await tx.companyMember.findFirst({
        where: {
          id: memberId,
          companyId,
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

      await assertNotLastOwner(tx, companyId, member.role.key, "member");

      await tx.companyMember.update({
        where: { id: member.id },
        data: {
          status: "DISABLED",
          deletedAt: new Date(),
        },
      });

      await writeAuditLog({
        action: "company.remove_member",
        userId: actor.id,
        companyId,
        entityType: "company_member",
        entityId: member.id,
        ...getClientMeta(req),
      });

      return { removed: true };
    });
  }

  async transferOwnership(
    companyId: string,
    memberId: string,
    actor: { id: string; roleKey: string },
    req: Request,
  ) {
    if (actor.roleKey !== "owner") {
      throw new ForbiddenError("Only owners can transfer ownership");
    }

    return prisma.$transaction(async (tx) => {
      await lockCompany(tx, companyId);

      const target = await tx.companyMember.findFirst({
        where: {
          id: memberId,
          companyId,
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
        where: { companyId, key: "owner" },
      });
      const adminRole = await tx.role.findFirst({
        where: { companyId, key: "admin" },
      });

      if (!ownerRole || !adminRole) {
        throw new Error("System roles missing");
      }

      const currentOwnerMembership = await tx.companyMember.findFirst({
        where: {
          companyId,
          userId: actor.id,
          deletedAt: null,
        },
      });

      if (!currentOwnerMembership) {
        throw new ForbiddenError("Current owner membership not found");
      }

      await tx.companyMember.update({
        where: { id: currentOwnerMembership.id },
        data: { roleId: adminRole.id },
      });

      await tx.companyMember.update({
        where: { id: target.id },
        data: { roleId: ownerRole.id },
      });

      await tx.company.update({
        where: { id: companyId },
        data: { ownerId: target.userId },
      });

      await writeAuditLog({
        action: "company.transfer_ownership",
        userId: actor.id,
        companyId,
        entityType: "company",
        entityId: companyId,
        metadata: { newOwnerId: target.userId },
        ...getClientMeta(req),
      });

      return { transferred: true, ownerId: target.userId };
    });
  }
}

export const companiesService = new CompaniesService();
