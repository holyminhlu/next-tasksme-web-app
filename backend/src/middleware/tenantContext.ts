import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/database.js";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../lib/errors.js";

export async function tenantContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const workspaceId = req.params.workspaceId;
    if (!workspaceId || typeof workspaceId !== "string") {
      throw new ValidationError("workspaceId route parameter is required");
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: req.user.id,
        deletedAt: null,
        status: "ACTIVE",
        workspace: {
          deletedAt: null,
          status: "ACTIVE",
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this workspace");
    }

    req.tenant = {
      workspaceId: membership.workspaceId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleKey: membership.role.key,
      status: membership.status,
      permissions: membership.role.rolePermissions.map(
        (item) => item.permission.key,
      ),
    };

    next();
  } catch (error) {
    next(error);
  }
}
