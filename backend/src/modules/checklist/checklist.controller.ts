import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import type {
  CreateChecklistItemInput,
  ReorderChecklistInput,
  UpdateChecklistItemInput,
} from "./checklist.schemas.js";
import { checklistService } from "./checklist.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await checklistService.list(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await checklistService.create(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      req.body as CreateChecklistItemInput,
    );
    sendSuccess(res, data, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await checklistService.update(
      param(req, "workspaceId"),
      param(req, "taskId"),
      param(req, "itemId"),
      actorFromRequest(req),
      req.body as UpdateChecklistItemInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function deleteChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await checklistService.remove(
      param(req, "workspaceId"),
      param(req, "taskId"),
      param(req, "itemId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function reorderChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await checklistService.reorder(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      req.body as ReorderChecklistInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}
