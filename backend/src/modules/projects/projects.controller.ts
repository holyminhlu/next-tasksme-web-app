import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type { CreateProjectInput } from "./projects.schemas.js";
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
    if (!req.tenant) {
      throw new ForbiddenError("Tenant context is required");
    }
    const projects = await projectsService.listProjects(
      getParam(req, "workspaceId"),
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
