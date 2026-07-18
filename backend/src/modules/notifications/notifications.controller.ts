import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  ListNotificationsQuery,
  UpdateNotificationPreferenceInput,
} from "./notifications.schemas.js";
import { notificationsService } from "./notifications.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await notificationsService.list(
      param(req, "workspaceId"),
      req.user.id,
      req.query as unknown as ListNotificationsQuery,
    );
    sendSuccess(res, result.items, {
      meta: {
        pagination: result.pagination,
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new UnauthorizedError();
    sendSuccess(
      res,
      await notificationsService.markRead(
        param(req, "workspaceId"),
        param(req, "notificationId"),
        req.user.id,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new UnauthorizedError();
    sendSuccess(
      res,
      await notificationsService.markAllRead(param(req, "workspaceId"), req.user.id),
    );
  } catch (error) {
    next(error);
  }
}

export async function getNotificationPreference(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new UnauthorizedError();
    sendSuccess(
      res,
      await notificationsService.getPreference(param(req, "workspaceId"), req.user.id),
    );
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationPreference(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new UnauthorizedError();
    sendSuccess(
      res,
      await notificationsService.updatePreference(
        param(req, "workspaceId"),
        req.user.id,
        req.body as UpdateNotificationPreferenceInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}
