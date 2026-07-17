import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { logger } from "../config/logger.js";

export function requirePermission(...permissionKeys: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      if (!req.tenant) {
        throw new ForbiddenError("Tenant context is required");
      }

      const hasPermission = permissionKeys.every((key) =>
        req.tenant?.permissions.includes(key),
      );

      if (!hasPermission) {
        logger.warn(
          {
            requestId: req.requestId,
            userId: req.user.id,
            companyId: req.tenant.companyId,
            required: permissionKeys,
            actual: req.tenant.permissions,
          },
          "Authorization denied",
        );
        throw new ForbiddenError("Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
