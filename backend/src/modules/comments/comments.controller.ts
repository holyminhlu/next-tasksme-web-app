import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import type {
  CreateCommentInput,
  ListCommentsQuery,
  UpdateCommentInput,
} from "./comments.schemas.js";
import { commentsService } from "./comments.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listComments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await commentsService.list(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      req.query as unknown as ListCommentsQuery,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await commentsService.create(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      req.body as CreateCommentInput,
    );
    sendSuccess(res, data, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await commentsService.update(
      param(req, "workspaceId"),
      param(req, "taskId"),
      param(req, "commentId"),
      actorFromRequest(req),
      req.body as UpdateCommentInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function deleteComment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await commentsService.remove(
      param(req, "workspaceId"),
      param(req, "taskId"),
      param(req, "commentId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}
