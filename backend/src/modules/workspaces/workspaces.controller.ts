import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { sendSuccess } from "../../lib/response.js";
import type { SystemRoleKey } from "../auth/permissions.js";
import type {
  ApplyModulePresetInput,
  CreateFirstProjectInput,
  CreateWorkspaceInput,
  UpdateModulesInput,
  UpdateOnboardingInput,
  UpdateWorkspaceInput,
} from "./workspaces.schemas.js";
import { workspacesService } from "./workspaces.service.js";

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

export async function createWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const workspace = await workspacesService.createWorkspace(
      req.user.id,
      req.body as CreateWorkspaceInput,
      req,
    );
    sendSuccess(res, workspace, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function getWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspace = await workspacesService.getWorkspace(
      getParam(req, "workspaceId"),
    );
    sendSuccess(res, workspace);
  } catch (error) {
    next(error);
  }
}

export async function updateWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const workspace = await workspacesService.updateWorkspace(
      getParam(req, "workspaceId"),
      req.body as UpdateWorkspaceInput,
      req.user.id,
      req,
    );
    sendSuccess(res, workspace);
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
    const result = await workspacesService.listMembers(
      getParam(req, "workspaceId"),
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
    const invitation = await workspacesService.inviteMember(
      getParam(req, "workspaceId"),
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
    const invitation = await workspacesService.getInvitationByToken(
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
    const result = await workspacesService.acceptInvitation(
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

    const result = await workspacesService.revokeInvitation(
      getParam(req, "workspaceId"),
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
    const member = await workspacesService.updateMemberRole(
      getParam(req, "workspaceId"),
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
    const result = await workspacesService.removeMember(
      getParam(req, "workspaceId"),
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
    const result = await workspacesService.transferOwnership(
      getParam(req, "workspaceId"),
      req.body.memberId as string,
      { id: actor.userId, roleKey: actor.roleKey },
      req,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const onboarding = await workspacesService.getOnboarding(
      getParam(req, "workspaceId"),
      req.user.id,
    );
    sendSuccess(res, onboarding);
  } catch (error) {
    next(error);
  }
}

export async function updateOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const onboarding = await workspacesService.updateOnboarding(
      getParam(req, "workspaceId"),
      req.user.id,
      req.body as UpdateOnboardingInput,
      req,
    );
    sendSuccess(res, onboarding);
  } catch (error) {
    next(error);
  }
}

export async function completeOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const onboarding = await workspacesService.completeOnboarding(
      getParam(req, "workspaceId"),
      req.user.id,
      req,
    );
    sendSuccess(res, onboarding);
  } catch (error) {
    next(error);
  }
}

export async function listModules(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const modules = await workspacesService.listModules(
      getParam(req, "workspaceId"),
    );
    sendSuccess(res, modules);
  } catch (error) {
    next(error);
  }
}

export async function applyModulePreset(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const modules = await workspacesService.applyModulePreset(
      getParam(req, "workspaceId"),
      req.body as ApplyModulePresetInput,
      req.user.id,
      req,
    );
    sendSuccess(res, modules);
  } catch (error) {
    next(error);
  }
}

export async function updateModules(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const modules = await workspacesService.updateModules(
      getParam(req, "workspaceId"),
      req.body as UpdateModulesInput,
      req.user.id,
      req,
    );
    sendSuccess(res, modules);
  } catch (error) {
    next(error);
  }
}

export async function createFirstProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const result = await workspacesService.createFirstProject(
      getParam(req, "workspaceId"),
      req.user.id,
      req.body as CreateFirstProjectInput,
      req,
    );
    sendSuccess(res, result, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}
