import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import type {
  CreateTagInput,
  ListTagsQuery,
  SetTaskTagsInput,
  UpdateTagInput,
} from "./tags.schemas.js";
import { tagsService } from "./tags.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listTags(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await tagsService.list(
      param(req, "workspaceId"),
      req.query as ListTagsQuery,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createTag(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await tagsService.create(
      param(req, "workspaceId"),
      actorFromRequest(req),
      req.body as CreateTagInput,
    );
    sendSuccess(res, data, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateTag(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await tagsService.update(
      param(req, "workspaceId"),
      param(req, "tagId"),
      actorFromRequest(req),
      req.body as UpdateTagInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function deleteTag(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await tagsService.remove(
      param(req, "workspaceId"),
      param(req, "tagId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function listTaskTags(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await tagsService.listForTask(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function setTaskTags(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await tagsService.setForTask(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      req.body as SetTaskTagsInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}
