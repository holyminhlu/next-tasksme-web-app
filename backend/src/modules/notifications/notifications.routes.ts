import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";
import {
  getNotificationPreference,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from "./notifications.controller.js";
import {
  listNotificationsQuerySchema,
  notificationParamsSchema,
  updateNotificationPreferenceSchema,
} from "./notifications.schemas.js";

export const notificationsRouter = Router({ mergeParams: true });
notificationsRouter.use(authenticate);
notificationsRouter.get(
  "/preferences",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  requirePermission("tasks:read"),
  getNotificationPreference,
);
notificationsRouter.patch(
  "/preferences",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: updateNotificationPreferenceSchema,
  }),
  tenantContext,
  requirePermission("tasks:read"),
  updateNotificationPreference,
);
notificationsRouter.get(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: listNotificationsQuerySchema,
  }),
  tenantContext,
  requirePermission("tasks:read"),
  listNotifications,
);
notificationsRouter.patch(
  "/read-all",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  requirePermission("tasks:read"),
  markAllNotificationsRead,
);
notificationsRouter.patch(
  "/:notificationId/read",
  validateRequest({ params: notificationParamsSchema }),
  tenantContext,
  requirePermission("tasks:read"),
  markNotificationRead,
);
