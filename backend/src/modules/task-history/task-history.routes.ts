import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { listTaskHistory } from "./task-history.controller.js";
import { taskHistoryParamsSchema } from "./task-history.schemas.js";

export const taskHistoryRouter = Router({ mergeParams: true });

taskHistoryRouter.use(authenticate);
taskHistoryRouter.get(
  "/",
  validateRequest({ params: taskHistoryParamsSchema }),
  tenantContext,
  requirePermission("task_history.view"),
  listTaskHistory,
);
