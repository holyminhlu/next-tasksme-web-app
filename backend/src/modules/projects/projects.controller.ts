import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  CreateProjectInput,
  EligibleAssigneesQuery,
  ReplaceProjectMembersInput,
  UpdateProjectVisibilityInput,
} from "./projects.schemas.js";
import { projectsService } from "./projects.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listProjects(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.tenant || !req.user) {
      throw new ForbiddenError("Tenant context is required");
    }
    const projects = await projectsService.listProjects(
      getParam(req, "workspaceId"),
      req.user.id,
      req.tenant.roleKey,
    );
    sendSuccess(res, projects);
  } catch (error) {
    next(error);
  }
}

export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.tenant) {
      throw new UnauthorizedError();
    }
    const project = await projectsService.createProject(
      getParam(req, "workspaceId"),
      req.user.id,
      req.body as CreateProjectInput,
    );
    sendSuccess(res, project, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

function actor(req: Request) {
  if (!req.user || !req.tenant) throw new UnauthorizedError();
  return { userId: req.user.id, roleKey: req.tenant.roleKey };
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.getProject(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listProjectMembers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await projectsService.listMembers(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function replaceProjectMembers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await projectsService.replaceMembers(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as ReplaceProjectMembersInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function updateProjectVisibility(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await projectsService.updateVisibility(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as UpdateProjectVisibilityInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listEligibleAssignees(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await projectsService.eligibleAssignees(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.query as EligibleAssigneesQuery,
      ),
    );
  } catch (error) {
    next(error);
  }
}
