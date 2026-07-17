import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { sendSuccess } from "../../lib/response.js";
import type { SystemRoleKey } from "../auth/permissions.js";
import { companiesService } from "./companies.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

function requireTenant(req: Request) {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError("Tenant context is required");
  }

  return {
    userId: req.user.id,
    roleKey: req.tenant.roleKey,
  };
}

export async function getCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await companiesService.getCompany(getParam(req, "companyId"));
    sendSuccess(res, company);
  } catch (error) {
    next(error);
  }
}

export async function updateCompany(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const company = await companiesService.updateCompany(
      getParam(req, "companyId"),
      req.body.name as string,
    );
    sendSuccess(res, company);
  } catch (error) {
    next(error);
  }
}

export async function listMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await companiesService.listMembers(
      getParam(req, "companyId"),
      req.query as unknown as PaginationQuery,
    );

    sendSuccess(res, result.members, {
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function inviteMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireTenant(req);
    const invitation = await companiesService.inviteMember(
      getParam(req, "companyId"),
      { id: actor.userId, roleKey: actor.roleKey },
      req.body as { email: string; roleKey: string },
      req,
    );
    sendSuccess(res, invitation, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function inspectInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const invitation = await companiesService.getInvitationByToken(
      String(req.query.token ?? req.params.token),
    );
    sendSuccess(res, invitation);
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await companiesService.acceptInvitation(
      req.body.token as string,
      {
        fullName: req.body.fullName as string | undefined,
        password: req.body.password as string | undefined,
      },
      req,
      req.user?.id,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function revokeInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const result = await companiesService.revokeInvitation(
      getParam(req, "companyId"),
      getParam(req, "invitationId"),
      req.user.id,
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireTenant(req);
    const member = await companiesService.updateMemberRole(
      getParam(req, "companyId"),
      getParam(req, "memberId"),
      req.body.roleKey as SystemRoleKey,
      { id: actor.userId, roleKey: actor.roleKey },
      req,
    );
    sendSuccess(res, member);
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireTenant(req);
    const result = await companiesService.removeMember(
      getParam(req, "companyId"),
      getParam(req, "memberId"),
      { id: actor.userId, roleKey: actor.roleKey },
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function transferOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireTenant(req);
    const result = await companiesService.transferOwnership(
      getParam(req, "companyId"),
      req.body.memberId as string,
      { id: actor.userId, roleKey: actor.roleKey },
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
