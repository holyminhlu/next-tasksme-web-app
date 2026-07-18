import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  CreateTaskInput,
  ListTasksQuery,
  ParseTaskInput,
  UpdateTaskInput,
} from "./tasks.schemas.js";
import { tasksService } from "./tasks.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

function requireActor(req: Request) {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError("Tenant context is required");
  }
  return {
    userId: req.user.id,
    roleKey: req.tenant.roleKey,
  };
}

export async function listTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const result = await tasksService.listTasks(
      getParam(req, "workspaceId"),
      actor,
      req.query as unknown as ListTasksQuery,
    );
    sendSuccess(res, result.items, {
      meta: { pagination: result.pagination },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const task = await tasksService.getTask(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      actor,
    );
    sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const actor = requireActor(req);
    const task = await tasksService.createTask(
      getParam(req, "workspaceId"),
      actor,
      req.body as CreateTaskInput,
    );
    sendSuccess(res, task, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const task = await tasksService.updateTask(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      actor,
      req.body as UpdateTaskInput,
    );
    sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const result = await tasksService.deleteTask(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      actor,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function parseTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const result = await tasksService.parseTask(
      getParam(req, "workspaceId"),
      actor,
      req.body as ParseTaskInput,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
