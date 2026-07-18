import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  CreateSavedViewInput,
  UpdateSavedViewInput,
} from "./saved-views.schemas.js";
import { savedViewsService } from "./saved-views.service.js";

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

export async function listSavedViews(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const items = await savedViewsService.list(
      getParam(req, "workspaceId"),
      requireActor(req),
    );
    sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
}

export async function getSavedView(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const view = await savedViewsService.get(
      getParam(req, "workspaceId"),
      getParam(req, "viewId"),
      requireActor(req),
    );
    sendSuccess(res, view);
  } catch (error) {
    next(error);
  }
}

export async function createSavedView(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const view = await savedViewsService.create(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.body as CreateSavedViewInput,
    );
    sendSuccess(res, view, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateSavedView(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const view = await savedViewsService.update(
      getParam(req, "workspaceId"),
      getParam(req, "viewId"),
      requireActor(req),
      req.body as UpdateSavedViewInput,
    );
    sendSuccess(res, view);
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedView(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await savedViewsService.remove(
      getParam(req, "workspaceId"),
      getParam(req, "viewId"),
      requireActor(req),
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
