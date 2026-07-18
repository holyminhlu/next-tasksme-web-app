import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import type { CreateDependencyInput } from "./dependencies.schemas.js";
import { dependenciesService } from "./dependencies.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listDependencies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await dependenciesService.list(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function createDependency(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await dependenciesService.create(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
        req.body as CreateDependencyInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteDependency(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await dependenciesService.remove(
        param(req, "workspaceId"),
        param(req, "taskId"),
        param(req, "dependencyId"),
        actorFromRequest(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}
