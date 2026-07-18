import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";
import {
  getDashboardActivity,
  getDashboardCharts,
  getDashboardMyWork,
  getDashboardSummary,
} from "./dashboard.controller.js";
import {
  activityQuerySchema,
  dashboardQuerySchema,
  myWorkQuerySchema,
} from "./dashboard.schemas.js";

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/summary",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: dashboardQuerySchema,
  }),
  tenantContext,
  requirePermission("dashboard:read"),
  getDashboardSummary,
);

dashboardRouter.get(
  "/my-work",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: myWorkQuerySchema,
  }),
  tenantContext,
  requirePermission("dashboard:read", "tasks:read"),
  getDashboardMyWork,
);

dashboardRouter.get(
  "/charts",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: dashboardQuerySchema,
  }),
  tenantContext,
  requirePermission("dashboard:read"),
  getDashboardCharts,
);

dashboardRouter.get(
  "/activity",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: activityQuerySchema,
  }),
  tenantContext,
  requirePermission("activity:read"),
  getDashboardActivity,
);
