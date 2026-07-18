import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import { taskHistoryService } from "./task-history.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listTaskHistory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await taskHistoryService.list(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}
