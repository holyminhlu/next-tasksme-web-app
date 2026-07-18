import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createSavedView,
  deleteSavedView,
  getSavedView,
  listSavedViews,
  updateSavedView,
} from "./saved-views.controller.js";
import {
  createSavedViewSchema,
  savedViewIdParamsSchema,
  updateSavedViewSchema,
  workspaceIdParamsSchema,
} from "./saved-views.schemas.js";

export const savedViewsRouter = Router({ mergeParams: true });

savedViewsRouter.use(authenticate);

savedViewsRouter.get(
  "/",
  validateRequest({ params: workspaceIdParamsSchema }),
  tenantContext,
  requirePermission("tasks:read"),
  listSavedViews,
);

savedViewsRouter.post(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: createSavedViewSchema,
  }),
  tenantContext,
  requirePermission("tasks:read"),
  createSavedView,
);

savedViewsRouter.get(
  "/:viewId",
  validateRequest({ params: savedViewIdParamsSchema }),
  tenantContext,
  requirePermission("tasks:read"),
  getSavedView,
);

savedViewsRouter.patch(
  "/:viewId",
  validateRequest({
    params: savedViewIdParamsSchema,
    body: updateSavedViewSchema,
  }),
  tenantContext,
  requirePermission("tasks:read"),
  updateSavedView,
);

savedViewsRouter.delete(
  "/:viewId",
  validateRequest({ params: savedViewIdParamsSchema }),
  tenantContext,
  requirePermission("tasks:read"),
  deleteSavedView,
);
