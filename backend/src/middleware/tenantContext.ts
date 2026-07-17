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

    const companyId = req.params.companyId;
    if (!companyId || typeof companyId !== "string") {
      throw new ValidationError("companyId route parameter is required");
    }

    const membership = await prisma.companyMember.findFirst({
      where: {
        companyId,
        userId: req.user.id,
        deletedAt: null,
        status: "ACTIVE",
        company: {
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
      throw new ForbiddenError("You are not a member of this company");
    }

    req.tenant = {
      companyId: membership.companyId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleKey: membership.role.key,
      status: membership.status,
      permissions: membership.role.rolePermissions.map((item) => item.permission.key),
    };

    next();
  } catch (error) {
    next(error);
  }
}
