import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import { attachmentsService } from "./attachments.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listAttachments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await attachmentsService.list(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const file = req.file;
    if (!file) {
      throw new ValidationError("file is required", { field: "file" });
    }
    const data = await attachmentsService.upload(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      file,
    );
    sendSuccess(res, data, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function downloadAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await attachmentsService.createDownloadUrl(
      param(req, "workspaceId"),
      param(req, "taskId"),
      param(req, "attachmentId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function deleteAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await attachmentsService.remove(
      param(req, "workspaceId"),
      param(req, "taskId"),
      param(req, "attachmentId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}
